import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir, tmpdir, userInfo } from "node:os";
import { join } from "node:path";
import { convertToLlm, type ExtensionAPI, type ExtensionContext, type AgentBeforeSettleEvent, type TurnEndEvent, type BoundaryResult } from "@earendil-works/pi-coding-agent";
import { matchesKey } from "@earendil-works/pi-tui";

const CHATGPT_ENDPOINT = "https://chatgpt.com/backend-api/wham/usage";
const CLAUDE_ENDPOINT = "https://api.anthropic.com/api/oauth/usage";
const STATUS = "z-usage";
const FIVE_HOURS = 5 * 60 * 60;
const SEVEN_DAYS = 7 * 24 * 60 * 60;
const REFRESH_MS = 60 * 1000;
const COUNTDOWN_MS = 60 * 1000;
const TIMEOUT_MS = 10 * 1000;
const BACKOFF_MS = 5 * 60 * 1000;

// Shared across pi processes so N sessions make one usage call per account, not N.
type Cache = { body?: unknown; until: number };
const cacheFile = (key: string) => join(tmpdir(), "pi-usage", `${key}.json`);
function readCache(file: string): Cache | undefined {
  try {
    const value = JSON.parse(readFileSync(file, "utf8"));
    return isRecord(value) && typeof value.until === "number" ? value as Cache : undefined;
  } catch { return undefined; }
}
function writeCache(file: string, cache: Cache) {
  try {
    mkdirSync(join(file, ".."), { recursive: true, mode: 0o700 });
    writeFileSync(`${file}.${process.pid}`, JSON.stringify(cache), { mode: 0o600 });
    renameSync(`${file}.${process.pid}`, file);
  } catch { /* The cache only saves requests; failing to write it must not hide fresh usage. */ }
}

type UsageWindow = { label: "5h" | "7d"; percent: number; resetAt: number };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

function accountId(token: string): string | undefined {
  try {
    const claims = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8"));
    const id = claims["https://api.openai.com/auth"]?.chatgpt_account_id;
    return typeof id === "string" && id.length > 0 && !/[\u0000-\u001f\u007f]/.test(id) ? id : undefined;
  } catch {
    return undefined;
  }
}

function parseUsage(value: unknown): UsageWindow[] {
  if (!isRecord(value) || !isRecord(value.rate_limit)) return [];
  const rateLimit = value.rate_limit;
  const windows = new Map<UsageWindow["label"], UsageWindow>();
  for (const raw of Object.values(rateLimit)) {
    if (!isRecord(raw)) continue;
    const item = raw;
    const label = item.limit_window_seconds === FIVE_HOURS ? "5h" : item.limit_window_seconds === SEVEN_DAYS ? "7d" : undefined;
    const percent = item.used_percent, resetAt = item.reset_at;
    if (!label || windows.has(label) || typeof percent !== "number" || !Number.isFinite(percent) || percent < 0 || percent > 100 ||
      typeof resetAt !== "number" || !Number.isFinite(resetAt * 1000)) continue;
    windows.set(label, { label, percent, resetAt });
  }
  return [windows.get("5h"), windows.get("7d")].filter((window): window is UsageWindow => window !== undefined);
}

function parseClaudeUsage(value: unknown): UsageWindow[] {
  if (!isRecord(value)) return [];
  const body = value;
  return parseUsage({ rate_limit: Object.fromEntries(([
    ["five_hour", FIVE_HOURS], ["seven_day", SEVEN_DAYS],
  ] as const).map(([key, seconds]) => {
    const window = body[key] as Record<string, unknown> | null | undefined;
    return [key, {
      limit_window_seconds: seconds,
      used_percent: window?.utilization,
      reset_at: typeof window?.resets_at === "string" ? Date.parse(window.resets_at) / 1000 : NaN,
    }];
  })) });
}

type Usage = { windows: UsageWindow[]; permission: "allowed" | "denied" | "absent" | "unknown" };

function usageEvidence(value: unknown): Usage {
  const windows = parseUsage(value);
  const rate = isRecord(value) ? value.rate_limit : undefined;
  if (!isRecord(rate) || !windows.length) return { windows, permission: "unknown" };
  const supported = Object.values(rate).filter((raw) => raw && typeof raw === "object" &&
    [FIVE_HOURS, SEVEN_DAYS].includes((raw as { limit_window_seconds: number }).limit_window_seconds));
  if (supported.length !== windows.length) return { windows, permission: "unknown" };
  const { allowed, limit_reached: reached } = rate;
  if ((allowed !== undefined && typeof allowed !== "boolean") || (reached !== undefined && typeof reached !== "boolean") ||
    (allowed !== undefined && reached !== undefined && allowed === reached)) return { windows, permission: "unknown" };
  const permission = allowed === true || reached === false ? "allowed" : allowed === false || reached === true ? "denied" : "absent";
  return { windows, permission };
}

function quotaState(usage: Usage | undefined): "allowed" | number | undefined {
  if (!usage || usage.permission === "unknown") return;
  if (usage.permission === "allowed") return "allowed";
  const exhausted = usage.windows.filter((window) => window.percent === 100);
  if (!exhausted.length) return usage.permission === "absent" ? "allowed" : undefined;
  const reset = Math.max(...exhausted.map((window) => window.resetAt * 1000));
  return reset > Date.now() ? reset : undefined;
}

// The adapter can flatten distinct 429 reasons into the same friendly sentence.
function errorCode(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return;
  const item = value as Record<string, unknown>;
  if (typeof item.code === "string") return item.code;
  if (typeof item.type === "string" && /^(usage_limit_reached|usage_not_included|rate_limit_exceeded)$/.test(item.type)) return item.type;
  return errorCode(item.error) ?? errorCode(item.response);
}

function textCode(text: string): string | undefined {
  const code = text.match(/\b(usage_limit_reached|usage_not_included|rate_limit_exceeded|insufficient_quota|billing_hard_limit_reached)\b/)?.[1];
  if (code) return code;
  if (/\brate limit (?:exceeded|reached)\b|\b(?:tokens|requests) per min(?:ute)?\b|\b[tr]pm\b/i.test(text)) return "rate_limit_exceeded";
}

function countdown(resetAt: number): string {
  const minutes = Math.ceil(Math.max(0, resetAt * 1000 - Date.now()) / 60_000);
  const days = Math.floor(minutes / 1440), hours = Math.floor((minutes % 1440) / 60), rest = minutes % 60;
  if (days) return `${days}d${hours ? `${hours}h` : ""}`;
  if (hours) return `${hours}h${rest ? `${rest}m` : ""}`;
  return `${minutes}m`;
}

function unavailable(ctx: ExtensionContext, label: string) {
  ctx.ui.setStatus(STATUS, ctx.ui.theme.fg("muted", `${label} unavailable`));
}

export default function usage(pi: ExtensionAPI) {
  let cleanup = () => {};
  let cancel = () => {};
  let capture = (_event: TurnEndEvent, _ctx: ExtensionContext) => {};
  let boundary = async (_event: AgentBeforeSettleEvent, _ctx: ExtensionContext): Promise<BoundaryResult | undefined> => {};
  let confirmClaudeExhaustion = async () => false;
  let providerCode: string | undefined;
  let responseStatus: number | undefined;
  let displayedProvider: string | undefined;

  pi.on("turn_start", () => { cancel(); providerCode = undefined; responseStatus = undefined; });
  pi.on("provider_stream_event", (event) => {
    if (event.provider === "openai-codex") providerCode = errorCode(event.data) ?? providerCode;
  });
  pi.on("after_provider_response", (event) => { responseStatus = event.status; });
  pi.on("message_end", async (event) => {
    const message = event.message;
    if (message.role !== "assistant" || message.provider !== "claude-code" || message.stopReason !== "error" ||
      !/^(?:Error: )?Incomplete Claude Code upstream response \(status 429,.*upstream said: This request would exceed your account's rate limit\./i.test(message.errorMessage ?? "")) return;
    if (!await confirmClaudeExhaustion()) return;
    // Pi excludes billing errors from native retries; preserve the upstream error for diagnostics.
    return { message: { ...message, errorMessage: `Claude Code billing: confirmed subscription quota exhaustion. ${message.errorMessage}` } };
  });
  pi.on("turn_end", (event, ctx) => capture(event, ctx));
  pi.on("agent_before_settle", (event, ctx) => boundary(event, ctx));
  pi.on("input", () => { cancel(); });
  pi.on("model_select", (_event, ctx) => {
    cancel();
    if (ctx.model?.provider !== displayedProvider) start(ctx);
  });
  pi.on("session_before_switch", () => { cancel(); });
  pi.on("session_before_fork", () => { cancel(); });

  const start = (ctx: ExtensionContext) => {
    cleanup();
    const provider = displayedProvider = ctx.model?.provider;
    const claude = provider === "claude-code";
    let label = claude ? "Claude" : "ChatGPT";
    capture = () => {};
    boundary = async () => {};
    confirmClaudeExhaustion = async () => false;
    cancel = () => {};
    if (ctx.mode !== "tui" || (provider !== "openai-codex" && provider !== "claude-code")) {
      ctx.ui.setStatus(STATUS, undefined);
      cleanup = () => {};
      return;
    }

    let stopped = false;
    let fetching: Promise<Usage | undefined> | undefined;
    let refreshId = 0;
    let requestEpoch = 0;
    let latest: UsageWindow[] = [];
    let hasError = false;
    let request: AbortController | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let refreshTimer: ReturnType<typeof setInterval> | undefined;
    let countdownTimer: ReturnType<typeof setInterval> | undefined;
    let confirmedClaudeReset: number | undefined;
    let candidate: { id: string; provider: string; model: string; session: string; refreshId: number; confirmedReset?: number } | undefined;
    let recovery: AbortController | undefined;
    let waitingUntil: number | undefined;
    let wake: (() => void) | undefined;

    const render = () => {
      if (stopped) return;
      if (waitingUntil !== undefined) {
        ctx.ui.setStatus(STATUS, ctx.ui.theme.fg("warning", `${label} quota reset in ${countdown(waitingUntil / 1000)} · Esc cancels`));
        return;
      }
      if (!latest.length) {
        if (hasError) unavailable(ctx, label);
        else ctx.ui.setStatus(STATUS, undefined);
        return;
      }
      const theme = ctx.ui.theme;
      const parts = latest.map((window) => {
        const used = Math.round(window.percent / 100 * 8);
        const remaining = 100 - window.percent;
        const remainingCells = 8 - used;
        const warning = remaining <= 10;
        const bar = `${remainingCells ? theme.fg(warning ? "warning" : "accent", "█".repeat(remainingCells)) : ""}${used ? theme.fg("muted", "░".repeat(used)) : ""}`;
        return `${theme.fg("accent", window.label)} ${bar} ${theme.fg(warning ? "warning" : "text", `${Math.round(remaining)}% left`)}${theme.fg("muted", ` ↻${countdown(window.resetAt)}`)}`;
      });
      ctx.ui.setStatus(STATUS, `${theme.fg("dim", "│")} ${claude ? `${theme.fg("accent", label)} ` : ""}${parts.join(theme.fg("dim", " │ "))}`);
    };

    const toUsage = (body: unknown): Usage => claude
      ? { windows: parseClaudeUsage(body), permission: "absent" } : usageEvidence(body);

    const fetchUsage = async (force: boolean): Promise<Usage | undefined> => {
      const epoch = requestEpoch;
      const active = () => !stopped && epoch === requestEpoch;
      let controller: AbortController | undefined;
      let file = "";
      let cached: Cache | undefined;
      // Fresh data from another session, or a shared 429 backoff (no body): never fetch, never show an error.
      const useCache = () => {
        if (!active()) return;
        const usage = cached?.body !== undefined ? toUsage(cached.body) : undefined;
        if (usage?.windows.length) { latest = usage.windows; hasError = false; }
        render();
        return usage?.windows.length ? usage : undefined;
      };
      try {
        controller = new AbortController();
        request = controller;
        timeout = setTimeout(() => controller?.abort(), TIMEOUT_MS);
        let token: string | undefined;
        const headers: Record<string, string> = { Accept: "application/json" };
        if (claude) {
          const env = { ...process.env, ...(await ctx.modelRegistry.getProviderAuth("claude-code"))?.env };
          if (!active() || controller.signal.aborted) return;
          const configDir = env.PI_CLAUDE_CODE_CONFIG_DIR || env.CLAUDE_CONFIG_DIR;
          label = !configDir || configDir === join(homedir(), ".claude") ? "Claude Personal"
            : configDir === join(homedir(), ".claude-vo2") ? "Claude VO2" : "Claude";
          // Claude hashes even an explicit ~/.claude; never fall back to another profile's item.
          const storageDir = env.CLAUDE_SECURESTORAGE_CONFIG_DIR ?? configDir;
          const suffix = storageDir ? `-${createHash("sha256").update(storageDir.normalize("NFC")).digest("hex").slice(0, 8)}` : "";
          file = cacheFile(`claude${suffix}`);
          cached = readCache(file);
          if (!force && cached && cached.until > Date.now()) return useCache();
          const result = await pi.exec("/usr/bin/security", [
            "find-generic-password", "-a", userInfo().username, "-s", `Claude Code-credentials${suffix}`, "-w",
          ], { signal: controller.signal, timeout: TIMEOUT_MS, maxBuffer: 64 * 1024 });
          if (!active() || controller.signal.aborted) return;
          if (result.code !== 0 || result.killed || result.truncated) throw new Error("Claude credentials unavailable");
          const credentials = JSON.parse(result.stdout);
          token = credentials?.claudeAiOauth?.accessToken;
          if (typeof token !== "string" || !token.trim()) throw new Error("Claude credentials unavailable");
          headers["anthropic-beta"] = "oauth-2025-04-20";
        } else {
          try { token = await ctx.modelRegistry.getApiKeyForProvider("openai-codex"); } catch { token = undefined; }
          if (!active() || controller.signal.aborted) return;
          if (typeof token !== "string" || !token.trim()) {
            latest = [];
            hasError = false;
            render();
            return;
          }
          const id = accountId(token);
          if (id) headers["ChatGPT-Account-Id"] = id;
          file = cacheFile(`chatgpt-${id ? createHash("sha256").update(id).digest("hex").slice(0, 8) : "default"}`);
          cached = readCache(file);
          if (!force && cached && cached.until > Date.now()) return useCache();
        }
        headers.Authorization = `Bearer ${token}`;
        const response = await fetch(claude ? CLAUDE_ENDPOINT : CHATGPT_ENDPOINT, {
          method: "GET", headers, signal: controller.signal, redirect: "error",
        });
        // The usage endpoint rate-limits per account across all pi sessions: back off everywhere and keep the last known quota.
        if (response.status === 429) {
          const retryAfter = Number(response.headers?.get?.("retry-after")) * 1000;
          writeCache(file, { body: cached?.body, until: Date.now() + (retryAfter > 0 ? retryAfter : BACKOFF_MS) });
          if (!latest.length && cached?.body !== undefined) latest = toUsage(cached.body).windows;
          render();
          return;
        }
        if (!response.ok) throw new Error("usage request failed");
        const body: unknown = await response.json();
        if (!active() || controller.signal.aborted) return;
        const usage = toUsage(body);
        if (claude && !usage.windows.length) throw new Error("Claude usage unavailable");
        writeCache(file, { body, until: Date.now() + REFRESH_MS - 5000 });
        latest = usage.windows;
        hasError = false;
        render();
        return usage;
      } catch {
        if (active()) {
          latest = [];
          hasError = true;
          if (waitingUntil === undefined) unavailable(ctx, label);
          else render();
        }
      } finally {
        if (timeout) clearTimeout(timeout);
        timeout = undefined;
        if (request === controller) request = undefined;
      }
    };
    // Quota verification forces a real request; periodic display refreshes may reuse another session's result.
    const refresh = (force = true) => {
      if (stopped) return Promise.resolve(undefined);
      if (!fetching) {
        refreshId++;
        fetching = fetchUsage(force).finally(() => { fetching = undefined; });
      }
      return fetching;
    };

    confirmClaudeExhaustion = async () => {
      if (!claude) return false;
      if (fetching) await fetching;
      const state = quotaState(await refresh());
      confirmedClaudeReset = !stopped && typeof state === "number" ? state : undefined;
      return confirmedClaudeReset !== undefined;
    };

    cancel = () => {
      confirmedClaudeReset = undefined;
      candidate = undefined;
      if (recovery) {
        requestEpoch++;
        recovery.abort();
        request?.abort();
        if (timeout) clearTimeout(timeout);
        timeout = undefined;
      }
      wake?.();
    };
    capture = (event, activeCtx) => {
      const confirmedReset = confirmedClaudeReset;
      cancel();
      const message = event.message;
      if (message.role !== "assistant" || message.stopReason !== "error" || message.provider !== provider) return;
      if (claude) {
        // pi-claude-code only reports plain text; the usage fetch must still confirm a 100% window before waiting.
        const text = message.errorMessage ?? "";
        if (!/^Claude Code billing:/.test(text) &&
          !(/^Claude Code API error:.*\b(usage limit|hit your limit|limit reached)\b/i.test(text) && !/\brate limit\b/i.test(text))) return;
        candidate = { id: event.messageEntryId, provider: message.provider, model: message.model,
          session: activeCtx.sessionManager.getSessionId(), refreshId, confirmedReset };
        return;
      }
      let code = providerCode ?? errorCode(message);
      try { code ??= errorCode(JSON.parse(message.errorMessage ?? "")); } catch { /* Adapter errors are usually plain text. */ }
      code ??= textCode(message.errorMessage ?? "");
      if (code && code !== "usage_limit_reached") return;
      const text = message.errorMessage ?? "";
      if (/\b(authentication|unauthorized|invalid[_ ]api[_ ]key|billing|usage_not_included|context_length_exceeded)\b/i.test(text)) return;
      if (!code && !/^You have hit your ChatGPT usage limit\b/.test(text) && responseStatus !== 429 && !/\b429\b/.test(text)) return;
      candidate = { id: event.messageEntryId, provider: message.provider, model: message.model,
        session: activeCtx.sessionManager.getSessionId(), refreshId };
    };

    boundary = async (event, activeCtx) => {
      const blocked = candidate;
      if (!blocked || recovery) return;
      if (event.outcome === "aborted" || event.context.pendingMessages.length) { cancel(); return; }
      const leaf = activeCtx.sessionManager.getLeafId();
      const owns = () => !stopped && candidate === blocked && !recovery?.signal.aborted &&
        activeCtx.sessionManager.getSessionId() === blocked.session && activeCtx.sessionManager.getLeafId() === leaf &&
        activeCtx.model?.provider === blocked.provider && activeCtx.model?.id === blocked.model &&
        activeCtx.sessionManager.getBranch().filter((entry) => entry.type === "message").at(-1)?.id === blocked.id;
      if (!owns()) { candidate = undefined; return; }
      const controller = new AbortController();
      recovery = controller;
      const cancelled = new Promise<undefined>((resolve) => controller.signal.addEventListener("abort", () => resolve(undefined), { once: true }));
      const removeInput = activeCtx.ui.onTerminalInput((data) => { if (matchesKey(data, "escape")) cancel(); });
      const onAbort = () => cancel();
      const signal = activeCtx.signal;
      signal?.addEventListener("abort", onAbort, { once: true });
      const verify = async (after: number) => {
        if (fetching && refreshId <= after) await Promise.race([fetching, cancelled]);
        if (!owns()) return;
        return Promise.race([refresh(), cancelled]);
      };
      const stop = (reason: string) => { if (owns()) activeCtx.ui.notify(`${label} quota recovery stopped: ${reason}.`, "warning"); };
      try {
        if (signal?.aborted) return;
        // message_end already verified this reset; another immediate fetch can hit the usage endpoint's rate limit.
        let state = blocked.confirmedReset ?? quotaState(await verify(blocked.refreshId));
        if (!owns()) return;
        if (typeof state !== "number") { stop("no confirmed exhaustion with a future reset"); return; }
        while (typeof state === "number" && owns()) {
          waitingUntil = state;
          render();
          await Promise.race([new Promise<void>((resolve) => {
            wake = resolve;
            if (waitingUntil !== undefined && Date.now() >= waitingUntil) resolve();
          }), cancelled]);
          wake = undefined;
          if (!owns()) return;
          state = quotaState(await verify(refreshId));
          if (!owns()) return;
          if (state === undefined) { stop("usage verification unavailable or reset untrustworthy"); return; }
        }
        if (!owns() || state !== "allowed") return;
        const projected = event.context.contextEntries;
        const messages = convertToLlm(projected.filter((entry) => entry.sourceEntry.id !== blocked.id).flatMap((entry) => entry.messages));
        if (!messages.some((message) => message.role !== "system") || messages.at(-1)?.role === "assistant") {
          stop("conversation cannot safely continue"); return;
        }
        candidate = undefined;
        return { continue: true, entries: [...event.entries, ...(projected.some((entry) => entry.sourceEntry.id === blocked.id && entry.messages.length)
          ? [{ type: "context_edit" as const, targetId: blocked.id, replacement: null }] : [])] };
      } finally {
        candidate = undefined;
        recovery = undefined;
        waitingUntil = undefined;
        wake = undefined;
        removeInput();
        signal?.removeEventListener("abort", onAbort);
        render();
      }
    };

    cleanup = () => {
      if (stopped) return;
      cancel();
      stopped = true;
      if (refreshTimer) clearInterval(refreshTimer);
      if (countdownTimer) clearInterval(countdownTimer);
      if (timeout) clearTimeout(timeout);
      request?.abort();
      ctx.ui.setStatus(STATUS, undefined);
    };
    ctx.ui.setStatus(STATUS, undefined);
    refreshTimer = setInterval(() => { void refresh(false); }, REFRESH_MS);
    countdownTimer = setInterval(() => {
      render();
      if (waitingUntil !== undefined && Date.now() >= waitingUntil) wake?.();
    }, COUNTDOWN_MS);
    void refresh(false);
  };

  pi.on("session_start", (_event, ctx) => start(ctx));
  pi.on("session_shutdown", () => cleanup());
}

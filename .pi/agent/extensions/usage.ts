import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir, tmpdir, userInfo } from "node:os";
import { join } from "node:path";
import { convertToLlm, type ExtensionAPI, type ExtensionContext, type AgentBeforeSettleEvent, type TurnEndEvent, type BoundaryResult } from "@earendil-works/pi-coding-agent";
import { matchesKey } from "@earendil-works/pi-tui";

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
  let claudeRecovery = false;
  let displayedProvider: string | undefined;

  pi.on("turn_start", () => { cancel(); });
  pi.on("message_end", async (event) => {
    const message = event.message;
    if (message.role !== "assistant" || message.provider !== "claude-code" || message.stopReason !== "error" ||
      !claudeRecovery || !/^(?:Error: )?Incomplete Claude Code upstream response \(status 429\b/i.test(message.errorMessage ?? "")) return;
    // Pi excludes billing errors from native retries; preserve the upstream error for diagnostics.
    return { message: { ...message, errorMessage: `Claude Code billing: subscription rate limit reached. ${message.errorMessage}` } };
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
    let label = "Claude";
    capture = () => {};
    boundary = async () => {};
    claudeRecovery = false;
    cancel = () => {};
    if (ctx.mode !== "tui" || provider !== "claude-code") {
      ctx.ui.setStatus(STATUS, undefined);
      cleanup = () => {};
      return;
    }

    claudeRecovery = true;
    let stopped = false;
    let fetching: Promise<void> | undefined;
    let requestEpoch = 0;
    let latest: UsageWindow[] = [];
    let hasError = false;
    let request: AbortController | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let refreshTimer: ReturnType<typeof setInterval> | undefined;
    let countdownTimer: ReturnType<typeof setInterval> | undefined;
    let candidate: { id: string; provider: string; model: string; session: string } | undefined;
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
        const bar = `${remainingCells ? theme.fg(warning ? "warning" : window.label === "7d" ? "mdLink" : "accent", "█".repeat(remainingCells)) : ""}${used ? theme.fg("muted", "░".repeat(used)) : ""}`;
        return `${theme.fg(warning ? "warning" : "text", `${Math.round(remaining)}%`)} ${bar}${theme.fg("muted", ` ↻${countdown(window.resetAt)}`)}`;
      });
      ctx.ui.setStatus(STATUS, parts.join(theme.fg("dim", " │ ")));
    };

    const fetchUsage = async (force: boolean): Promise<void> => {
      const epoch = requestEpoch;
      const active = () => !stopped && epoch === requestEpoch;
      let controller: AbortController | undefined;
      let file = "";
      let cached: Cache | undefined;
      // Fresh data from another session, or a shared 429 backoff (no body): never fetch, never show an error.
      const useCache = () => {
        if (!active()) return;
        const windows = cached?.body !== undefined ? parseClaudeUsage(cached.body) : [];
        if (windows.length) { latest = windows; hasError = false; }
        render();
      };
      try {
        controller = new AbortController();
        request = controller;
        timeout = setTimeout(() => controller?.abort(), TIMEOUT_MS);
        const headers: Record<string, string> = { Accept: "application/json" };
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
        const token = credentials?.claudeAiOauth?.accessToken;
        if (typeof token !== "string" || !token.trim()) throw new Error("Claude credentials unavailable");
        headers["anthropic-beta"] = "oauth-2025-04-20";
        headers.Authorization = `Bearer ${token}`;
        const response = await fetch(CLAUDE_ENDPOINT, {
          method: "GET", headers, signal: controller.signal, redirect: "error",
        });
        // The usage endpoint rate-limits per account across all pi sessions: back off everywhere and keep the last known quota.
        if (response.status === 429) {
          const retryAfter = Number(response.headers?.get?.("retry-after")) * 1000;
          writeCache(file, { body: cached?.body, until: Date.now() + (retryAfter > 0 ? retryAfter : BACKOFF_MS) });
          if (!latest.length && cached?.body !== undefined) latest = parseClaudeUsage(cached.body);
          render();
          return;
        }
        if (!response.ok) throw new Error("usage request failed");
        const body: unknown = await response.json();
        if (!active() || controller.signal.aborted) return;
        const windows = parseClaudeUsage(body);
        if (!windows.length) throw new Error("Claude usage unavailable");
        writeCache(file, { body, until: Date.now() + REFRESH_MS - 5000 });
        latest = windows;
        hasError = false;
        render();
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
    // Periodic display refreshes may reuse another session's result.
    const refresh = (force = true) => {
      if (stopped) return Promise.resolve();
      if (!fetching) {
        fetching = fetchUsage(force).finally(() => { fetching = undefined; });
      }
      return fetching;
    };

    // The 429 carries no reset time: use Claude Code's last per-turn rate-limit report, then the usage bar, then a short retry.
    const claudeReset = (activeCtx: ExtensionContext): number => {
      const info = activeCtx.sessionManager.getBranch().flatMap((entry) => entry.type === "message" && entry.message.role === "assistant"
        ? (entry.message as { diagnostics?: { type: string; details?: unknown }[] }).diagnostics ?? [] : [])
        .filter((item) => item.type === "claude-code.rate-limit").at(-1)?.details;
      const reported = isRecord(info) && isRecord(info.unifiedWindows) ? Object.values(info.unifiedWindows).flatMap((raw) =>
        isRecord(raw) && typeof raw.utilization === "number" && typeof raw.resetsAt === "number"
          ? [{ percent: raw.utilization * 100, resetAt: raw.resetsAt }] : []) : [];
      const windows = (reported.length ? reported : latest).filter((window) => window.resetAt * 1000 > Date.now());
      const fullest = windows.sort((a, b) => b.percent - a.percent || b.resetAt - a.resetAt)[0];
      return fullest ? fullest.resetAt * 1000 : Date.now() + BACKOFF_MS;
    };

    cancel = () => {
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
      cancel();
      const message = event.message;
      if (message.role !== "assistant" || message.stopReason !== "error" || message.provider !== provider) return;
      const text = message.errorMessage ?? "";
      if (!/^Claude Code billing:/.test(text) && !/^Claude Code API error:.*\b(usage limit|hit your limit|limit reached|rate limit)\b/i.test(text)) return;
      candidate = { id: event.messageEntryId, provider: message.provider, model: message.model,
        session: activeCtx.sessionManager.getSessionId() };
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
      const stop = (reason: string) => { if (owns()) activeCtx.ui.notify(`${label} quota recovery stopped: ${reason}.`, "warning"); };
      try {
        if (signal?.aborted) return;
        // Retry once after the reset; a new 429 waits again.
        waitingUntil = claudeReset(activeCtx);
        render();
        await Promise.race([new Promise<void>((resolve) => {
          wake = resolve;
          if (waitingUntil !== undefined && Date.now() >= waitingUntil) resolve();
        }), cancelled]);
        wake = undefined;
        if (!owns()) return;
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

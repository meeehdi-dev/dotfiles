import { Buffer } from "node:buffer";
import { convertToLlm, type ExtensionAPI, type ExtensionContext, type AgentBeforeSettleEvent, type TurnEndEvent, type BoundaryResult } from "@earendil-works/pi-coding-agent";
import { matchesKey } from "@earendil-works/pi-tui";

const ENDPOINT = "https://chatgpt.com/backend-api/wham/usage";
const STATUS = "z-chatgpt-usage";
const FIVE_HOURS = 5 * 60 * 60;
const SEVEN_DAYS = 7 * 24 * 60 * 60;
const REFRESH_MS = 60 * 1000;
const COUNTDOWN_MS = 60 * 1000;
const TIMEOUT_MS = 10 * 1000;

type UsageWindow = { label: "5h" | "7d"; percent: number; resetAt: number };

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
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const rateLimit = (value as Record<string, unknown>).rate_limit;
  if (!rateLimit || typeof rateLimit !== "object" || Array.isArray(rateLimit)) return [];
  const windows = new Map<UsageWindow["label"], UsageWindow>();
  for (const raw of Object.values(rateLimit)) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const item = raw as Record<string, unknown>;
    const label = item.limit_window_seconds === FIVE_HOURS ? "5h" : item.limit_window_seconds === SEVEN_DAYS ? "7d" : undefined;
    const percent = item.used_percent, resetAt = item.reset_at;
    if (!label || windows.has(label) || typeof percent !== "number" || !Number.isFinite(percent) || percent < 0 || percent > 100 ||
      typeof resetAt !== "number" || !Number.isFinite(resetAt * 1000)) continue;
    windows.set(label, { label, percent, resetAt });
  }
  return [windows.get("5h"), windows.get("7d")].filter((window): window is UsageWindow => window !== undefined);
}

type Usage = { windows: UsageWindow[]; permission: "allowed" | "denied" | "absent" | "unknown" };

function usageEvidence(value: unknown): Usage {
  const windows = parseUsage(value);
  const rate = value && typeof value === "object" ? (value as Record<string, unknown>).rate_limit : undefined;
  if (!rate || typeof rate !== "object" || Array.isArray(rate) || !windows.length) return { windows, permission: "unknown" };
  const supported = Object.values(rate).filter((raw) => raw && typeof raw === "object" &&
    [FIVE_HOURS, SEVEN_DAYS].includes((raw as { limit_window_seconds: number }).limit_window_seconds));
  if (supported.length !== windows.length) return { windows, permission: "unknown" };
  const { allowed, limit_reached: reached } = rate as Record<string, unknown>;
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

function unavailable(ctx: ExtensionContext) {
  ctx.ui.setStatus(STATUS, ctx.ui.theme.fg("muted", "ChatGPT unavailable"));
}

export default function chatgptUsage(pi: ExtensionAPI) {
  let cleanup = () => {};
  let cancel = () => {};
  let capture = (_event: TurnEndEvent, _ctx: ExtensionContext) => {};
  let boundary = async (_event: AgentBeforeSettleEvent, _ctx: ExtensionContext): Promise<BoundaryResult | undefined> => {};
  let providerCode: string | undefined;
  let responseStatus: number | undefined;

  pi.on("turn_start", () => { cancel(); providerCode = undefined; responseStatus = undefined; });
  pi.on("provider_stream_event", (event) => {
    if (event.provider === "openai-codex") providerCode = errorCode(event.data) ?? providerCode;
  });
  pi.on("after_provider_response", (event) => { responseStatus = event.status; });
  pi.on("turn_end", (event, ctx) => capture(event, ctx));
  pi.on("agent_before_settle", (event, ctx) => boundary(event, ctx));
  pi.on("input", () => { cancel(); });
  pi.on("model_select", () => { cancel(); });
  pi.on("session_before_switch", () => { cancel(); });
  pi.on("session_before_fork", () => { cancel(); });

  pi.on("session_start", (_event, ctx) => {
    cleanup();
    capture = () => {};
    boundary = async () => {};
    cancel = () => {};
    if (ctx.mode !== "tui") {
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
    let candidate: { id: string; provider: string; model: string; session: string; refreshId: number } | undefined;
    let recovery: AbortController | undefined;
    let waitingUntil: number | undefined;
    let wake: (() => void) | undefined;

    const render = () => {
      if (stopped) return;
      if (waitingUntil !== undefined) {
        ctx.ui.setStatus(STATUS, ctx.ui.theme.fg("warning", `ChatGPT quota reset in ${countdown(waitingUntil / 1000)} · Esc cancels`));
        return;
      }
      if (!latest.length) {
        if (hasError) unavailable(ctx);
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
      ctx.ui.setStatus(STATUS, `${theme.fg("dim", "│")} ${parts.join(theme.fg("dim", " │ "))}`);
    };

    const fetchUsage = async (): Promise<Usage | undefined> => {
      const epoch = requestEpoch;
      const active = () => !stopped && epoch === requestEpoch;
      let controller: AbortController | undefined;
      try {
        let token: string | undefined;
        try { token = await ctx.modelRegistry.getApiKeyForProvider("openai-codex"); } catch { token = undefined; }
        if (!active()) return;
        if (typeof token !== "string" || !token.trim()) {
          latest = [];
          hasError = false;
          render();
          return;
        }

        controller = new AbortController();
        request = controller;
        timeout = setTimeout(() => controller?.abort(), TIMEOUT_MS);
        const headers: Record<string, string> = { Authorization: `Bearer ${token}`, Accept: "application/json" };
        const id = accountId(token);
        if (id) headers["ChatGPT-Account-Id"] = id;
        const response = await fetch(ENDPOINT, { method: "GET", headers, signal: controller.signal, redirect: "error" });
        if (!response.ok) throw new Error("usage request failed");
        const body: unknown = await response.json();
        if (!active() || controller.signal.aborted) return;
        const usage = usageEvidence(body);
        latest = usage.windows;
        hasError = false;
        render();
        return usage;
      } catch {
        if (active()) {
          latest = [];
          hasError = true;
          if (waitingUntil === undefined) unavailable(ctx);
          else render();
        }
      } finally {
        if (timeout) clearTimeout(timeout);
        timeout = undefined;
        if (request === controller) request = undefined;
      }
    };
    const refresh = () => {
      if (stopped) return Promise.resolve(undefined);
      if (!fetching) {
        refreshId++;
        fetching = fetchUsage().finally(() => { fetching = undefined; });
      }
      return fetching;
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
      if (message.role !== "assistant" || message.stopReason !== "error" || message.provider !== "openai-codex") return;
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
      const stop = (reason: string) => { if (owns()) activeCtx.ui.notify(`ChatGPT quota recovery stopped: ${reason}.`, "warning"); };
      try {
        if (signal?.aborted) return;
        let state = quotaState(await verify(blocked.refreshId));
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
    refreshTimer = setInterval(() => { void refresh(); }, REFRESH_MS);
    countdownTimer = setInterval(() => {
      render();
      if (waitingUntil !== undefined && Date.now() >= waitingUntil) wake?.();
    }, COUNTDOWN_MS);
    void refresh();
  });

  pi.on("session_shutdown", () => cleanup());
}

import { Buffer } from "node:buffer";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const ENDPOINT = "https://chatgpt.com/backend-api/wham/usage";
const STATUS = "z-chatgpt-usage";
const FIVE_HOURS = 5 * 60 * 60;
const SEVEN_DAYS = 7 * 24 * 60 * 60;
const REFRESH_MS = 5 * 60 * 1000;
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

  pi.on("session_start", (_event, ctx) => {
    cleanup();
    if (ctx.mode !== "tui") {
      ctx.ui.setStatus(STATUS, undefined);
      cleanup = () => {};
      return;
    }

    let stopped = false;
    let fetching = false;
    let latest: UsageWindow[] = [];
    let hasError = false;
    let request: AbortController | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let refreshTimer: ReturnType<typeof setInterval> | undefined;
    let countdownTimer: ReturnType<typeof setInterval> | undefined;

    const render = () => {
      if (stopped) return;
      if (!latest.length) {
        if (!hasError) ctx.ui.setStatus(STATUS, undefined);
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

    const refresh = async () => {
      if (stopped || fetching) return;
      fetching = true;
      let controller: AbortController | undefined;
      try {
        let token: string | undefined;
        try { token = await ctx.modelRegistry.getApiKeyForProvider("openai-codex"); } catch { token = undefined; }
        if (stopped) return;
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
        if (stopped) return;
        latest = parseUsage(body);
        hasError = false;
        render();
      } catch {
        if (!stopped) {
          latest = [];
          hasError = true;
          unavailable(ctx);
        }
      } finally {
        if (timeout) clearTimeout(timeout);
        timeout = undefined;
        if (request === controller) request = undefined;
        fetching = false;
      }
    };

    cleanup = () => {
      if (stopped) return;
      stopped = true;
      if (refreshTimer) clearInterval(refreshTimer);
      if (countdownTimer) clearInterval(countdownTimer);
      if (timeout) clearTimeout(timeout);
      request?.abort();
      ctx.ui.setStatus(STATUS, undefined);
    };
    ctx.ui.setStatus(STATUS, undefined);
    refreshTimer = setInterval(() => { void refresh(); }, REFRESH_MS);
    countdownTimer = setInterval(render, COUNTDOWN_MS);
    void refresh();
  });

  pi.on("session_shutdown", () => cleanup());
}

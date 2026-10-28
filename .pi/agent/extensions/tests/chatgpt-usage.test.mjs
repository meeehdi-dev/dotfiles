import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const extensionPath = resolve(fileURLToPath(new URL("..", import.meta.url)), "chatgpt-usage.ts");
const install = join(homedir(), ".pi/agent/install");
const piRoot = process.env.PI_TEST_PACKAGE_ROOT ?? join(install, "releases", readFileSync(join(install, "current-version"), "utf8").trim(), "node_modules/@earendil-works/pi-coding-agent");
const { loadExtensions, createExtensionRuntime } = await import(pathToFileURL(join(piRoot, "dist/core/extensions/loader.js")));
const { createEventBus } = await import(pathToFileURL(join(piRoot, "dist/core/event-bus.js")));
const { AgentSession, SessionManager, SettingsManager, convertToLlm } = await import(pathToFileURL(join(piRoot, "dist/index.js")));
const { Agent } = await import(pathToFileURL(join(piRoot, "../pi-agent-core/dist/index.js")));
const { AssistantMessageEventStream } = await import(pathToFileURL(join(piRoot, "../pi-ai/dist/utils/event-stream.js")));
const now = 1_700_000_000_000;
const reset = (seconds) => now / 1000 + seconds;
const quota = (duration, used, resetAt) => ({ limit_window_seconds: duration, used_percent: used, reset_at: resetAt });
const jwt = (claims = {}) => `header.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.signature`;

function assertQuotaBars(text, expectedRemaining) {
  const cells = [...text.matchAll(/<[^:]+:([█░]+)>/g)].map(([, value]) => value).join("");
  const bars = cells.match(/[█░]{8}/g) ?? [];
  assert.equal(bars.length, expectedRemaining.length);
  bars.forEach((bar, index) => {
    assert.equal([...bar].filter((cell) => cell === "█").length, expectedRemaining[index]);
    assert.equal([...bar].filter((cell) => cell === "░").length, 8 - expectedRemaining[index]);
  });
}

async function harness({ mode = "tui", token = jwt(), body, fetchImpl, nowMs = now } = {}) {
  const runtime = createExtensionRuntime(), bus = createEventBus(), statuses = [], fetches = [], timers = [];
  const listeners = new Set(), notifications = [];
  let branch = [], sessionId = "session-one";
  const loaded = await loadExtensions([extensionPath], process.cwd(), bus, runtime);
  assert.deepEqual(loaded.errors, [], "Pi must accept the usage extension");
  const extension = loaded.extensions[0];
  const previous = {
    fetch: globalThis.fetch, setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout,
    setInterval: globalThis.setInterval, clearInterval: globalThis.clearInterval, now: Date.now,
  };
  let id = 0, clock = nowMs;
  const timer = (kind, callback, delay) => {
    const value = { id: ++id, kind, callback, delay, cleared: false };
    timers.push(value);
    return value;
  };
  globalThis.setTimeout = (callback, delay) => timer("timeout", callback, delay);
  globalThis.clearTimeout = (value) => { if (value) value.cleared = true; };
  globalThis.setInterval = (callback, delay) => timer("interval", callback, delay);
  globalThis.clearInterval = (value) => { if (value) value.cleared = true; };
  Date.now = () => clock;
  globalThis.fetch = async (url, options) => {
    fetches.push({ url, options });
    if (fetchImpl) return fetchImpl(url, options);
    return { ok: true, json: async () => body };
  };
  const ctx = {
    mode,
    model: { provider: "openai-codex", id: "test-model" },
    sessionManager: {
      getSessionId: () => sessionId,
      getLeafId: () => branch.at(-1)?.id,
      getBranch: () => branch,
    },
    modelRegistry: { getApiKeyForProvider: async (provider) => { assert.equal(provider, "openai-codex"); return token; } },
    ui: {
      theme: { fg: (color, text) => `<${color}:${text}>` },
      setStatus: (key, text) => statuses.push({ key, text }),
      notify: (text, level) => notifications.push({ text, level }),
      onTerminalInput: (handler) => { listeners.add(handler); return () => listeners.delete(handler); },
    },
  };
  const emit = async (name, payload = {}) => {
    let result;
    for (const handler of extension.handlers.get(name) ?? []) result = await handler({ type: name, ...payload }, ctx);
    return result;
  };
  const settle = async () => { for (let i = 0; i < 5; i++) await new Promise((resolve) => setImmediate(resolve)); };
  return {
    statuses, fetches, timers, emit, settle, ctx, listeners, notifications, extension, loaded, runtime,
    setBranch(value) { branch = value; },
    setSession(value) { sessionId = value; },
    key(data) { for (const handler of listeners) assert.equal(handler(data), undefined, "terminal input must pass through"); },
    setNow(value) { clock = value; },
    async start() { await emit("session_start"); await settle(); },
    async close() {
      await emit("session_shutdown");
      await settle();
      globalThis.fetch = previous.fetch;
      globalThis.setTimeout = previous.setTimeout;
      globalThis.clearTimeout = previous.clearTimeout;
      globalThis.setInterval = previous.setInterval;
      globalThis.clearInterval = previous.clearInterval;
      Date.now = previous.now;
      runtime.invalidate(); bus.clear();
    },
  };
}

// Synthetic fixtures follow the installed adapter shape, not an observed quota incident.
const failure = (extra = {}) => ({ role: "assistant", provider: "openai-codex", model: "test-model", api: "openai-codex-responses",
  content: [], stopReason: "error", errorMessage: "You have hit your ChatGPT usage limit (plus plan). Try again in ~60 min.", timestamp: now, ...extra });
const usageBody = (percent = 100, seconds = 3600, flags = {}) => ({ rate_limit: { primary_window: quota(18000, percent, reset(seconds)), ...flags } });

async function fail(h, message = failure(), extra = {}) {
  const user = { id: "user", type: "message", message: { role: "user", content: "original", timestamp: now } };
  const failed = { id: "failed", type: "message", message };
  h.setBranch([user, failed]);
  await h.emit("turn_start");
  await h.emit("turn_end", { message, messageEntryId: failed.id });
  return { outcome: "error", entries: [], continue: false, context: { pendingMessages: [],
    contextEntries: [user, failed].map((sourceEntry) => ({ sourceEntry, messages: [sourceEntry.message] })) }, ...extra };
}

function tickCountdown(h, at) {
  h.setNow(at);
  h.timers.filter(({ kind, delay, cleared }) => kind === "interval" && delay === 60_000 && !cleared).at(-1).callback();
}

test("uses reported durations, styles both windows, and counts down from reset timestamps", async (t) => {
  const token = jwt({ "https://api.openai.com/auth": { chatgpt_account_id: "account-private" } });
  const h = await harness({ token, body: { rate_limit: {
    secondary_window: quota(604800, 9.6, reset(2 * 86400 + 3 * 3600)),
    primary_window: quota(18000, 24.6, reset(9000)),
  } } });
  t.after(() => h.close());
  await h.start();
  assert.equal(h.fetches.length, 1);
  assert.equal(h.fetches[0].url, "https://chatgpt.com/backend-api/wham/usage");
  assert.equal(h.fetches[0].options.redirect, "error");
  assert.equal(h.fetches[0].options.headers.Authorization, `Bearer ${token}`);
  assert.equal(h.fetches[0].options.headers["ChatGPT-Account-Id"], "account-private");
  assert.deepEqual(h.statuses.at(-1), {
    key: "z-chatgpt-usage",
    text: "<dim:│> <accent:5h> <accent:██████><muted:░░> <text:75% left><muted: ↻2h30m><dim: │ ><accent:7d> <accent:███████><muted:░> <text:90% left><muted: ↻2d3h>",
  });
  assertQuotaBars(h.statuses.at(-1).text, [6, 7]);
  assert.doesNotMatch(h.statuses.at(-1).text, /GPT/);
  assert.ok(!h.statuses.at(-1).text.includes(token));
  assert.ok(!h.statuses.at(-1).text.includes("account-private"));
  const [refresh, countdown] = h.timers.filter(({ kind, delay }) => kind === "interval" && delay === 60_000);
  assert.ok(refresh);
  assert.ok(countdown);
  h.setNow(now + 60_000);
  countdown.callback();
  await h.settle();
  assert.match(h.statuses.at(-1).text, /↻2h29m/);
  assert.equal(h.fetches.length, 1, "countdown ticks do not refresh quota early");
});

test("renders fully remaining and fully used quota bars", async (t) => {
  const h = await harness({ body: { rate_limit: {
    empty: quota(18000, 0, reset(0)),
    full: quota(604800, 100, reset(0)),
  } } });
  t.after(() => h.close());
  await h.start();
  assert.equal(h.statuses.at(-1).text,
    "<dim:│> <accent:5h> <accent:████████> <text:100% left><muted: ↻0m><dim: │ ><accent:7d> <muted:░░░░░░░░> <warning:0% left><muted: ↻0m>");
  assertQuotaBars(h.statuses.at(-1).text, [8, 0]);
  assert.doesNotMatch(h.statuses.at(-1).text, /GPT/);
});

test("warns at exactly 10% remaining and mutes the spent cells", async (t) => {
  const h = await harness({ body: { rate_limit: { primary: quota(18000, 90, reset(0)) } } });
  t.after(() => h.close());
  await h.start();
  assert.equal(h.statuses.at(-1).text,
    "<dim:│> <accent:5h> <warning:█><muted:░░░░░░░> <warning:10% left><muted: ↻0m>");
  assertQuotaBars(h.statuses.at(-1).text, [1]);
  assert.doesNotMatch(h.statuses.at(-1).text, /GPT/);
});

test("omits malformed or missing windows instead of guessing their duration", async (t) => {
  const h = await harness({ body: { rate_limit: {
    bad_percent: quota(18000, 101, reset(5000)),
    unsupported: quota(3600, 5, reset(4000)),
    valid_week: quota(604800, 70, reset(180000)),
  } } });
  t.after(() => h.close());
  await h.start();
  assert.match(h.statuses.at(-1).text, /<accent:7d>/);
  assert.doesNotMatch(h.statuses.at(-1).text, /<accent:5h>/);
  assert.doesNotMatch(h.statuses.at(-1).text, /<accent:1h>/);

  await h.close();
  const missing = await harness({ body: { rate_limit: { primary_window: quota(18000, "bad", reset(5000)) } } });
  t.after(() => missing.close());
  await missing.start();
  assert.deepEqual(missing.statuses.at(-1), { key: "z-chatgpt-usage", text: undefined });
});

test("makes no request without usable auth and leaves the item clear", async (t) => {
  const h = await harness({ token: null, body: { rate_limit: {} } });
  t.after(() => h.close());
  await h.start();
  assert.equal(h.fetches.length, 0);
  assert.deepEqual(h.statuses.at(-1), { key: "z-chatgpt-usage", text: undefined });
});

test("network, HTTP, and JSON failures show only a generic unavailable status", async (t) => {
  for (const fetchImpl of [
    async () => { throw new Error("private access token and account claim"); },
    async () => ({ ok: false, json: async () => ({ secret: "provider response" }) }),
    async () => ({ ok: true, json: async () => { throw new Error("private response body"); } }),
  ]) {
    const h = await harness({ token: jwt({ "https://api.openai.com/auth": { chatgpt_account_id: "account-private" } }), fetchImpl });
    t.after(() => h.close());
    await h.start();
    const text = h.statuses.at(-1).text;
    assert.equal(text, "<muted:ChatGPT unavailable>");
    assert.equal(h.statuses.at(-1).key, "z-chatgpt-usage");
    assert.doesNotMatch(text, /private|secret|account-private|provider response/);
    const [, countdown] = h.timers.filter(({ kind, delay }) => kind === "interval" && delay === 60_000);
    assert.ok(countdown);
    countdown.callback();
    await h.settle();
    assert.deepEqual(h.statuses.at(-1), { key: "z-chatgpt-usage", text: "<muted:ChatGPT unavailable>" });
    assert.equal(h.fetches.length, 1, "countdown ticks do not trigger an early retry");
  }
});

test("clears stale quota on failure and replaces unavailable status after the next refresh", async (t) => {
  const body = { rate_limit: { primary: quota(18000, 25, reset(5000)) } };
  let requests = 0;
  const h = await harness({ fetchImpl: async () => {
    requests++;
    if (requests === 2) return { ok: false, json: async () => ({}) };
    return { ok: true, json: async () => body };
  } });
  t.after(() => h.close());
  await h.start();
  assert.match(h.statuses.at(-1).text, /<accent:5h>/);

  const [refresh, countdown] = h.timers.filter(({ kind, delay }) => kind === "interval" && delay === 60_000);
  assert.ok(refresh && countdown);
  refresh.callback();
  await h.settle();
  assert.deepEqual(h.statuses.at(-1), { key: "z-chatgpt-usage", text: "<muted:ChatGPT unavailable>" });
  countdown.callback();
  await h.settle();
  assert.deepEqual(h.statuses.at(-1), { key: "z-chatgpt-usage", text: "<muted:ChatGPT unavailable>" });
  assert.equal(h.fetches.length, 2, "countdown ticks do not trigger an early retry");

  refresh.callback();
  await h.settle();
  assert.match(h.statuses.at(-1).text, /<accent:5h>/);
  assert.equal(h.fetches.length, 3);
});

test("does not fetch or start timers outside TUI; shutdown aborts and clears TUI work", async (t) => {
  const rpc = await harness({ mode: "rpc", body: { rate_limit: {} } });
  t.after(() => rpc.close());
  await rpc.start();
  assert.equal(rpc.fetches.length, 0);
  assert.equal(rpc.timers.length, 0);

  let signal;
  const tui = await harness({ fetchImpl: async (_url, options) => {
    signal = options.signal;
    return new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true }));
  } });
  t.after(() => tui.close());
  await tui.emit("session_start");
  await tui.settle();
  assert.ok(signal);
  const refresh = tui.timers.find(({ kind, delay }) => kind === "interval" && delay === 60_000);
  const timeout = tui.timers.find(({ kind, delay }) => kind === "timeout" && delay === 10_000);
  assert.ok(refresh && timeout && !timeout.cleared);
  refresh.callback();
  await tui.settle();
  assert.equal(tui.fetches.length, 1, "refresh skips an in-flight request");
  timeout.callback();
  await tui.settle();
  assert.equal(signal.aborted, true);
  assert.deepEqual(tui.statuses.at(-1), { key: "z-chatgpt-usage", text: "<muted:ChatGPT unavailable>" });
  await tui.emit("session_shutdown");
  assert.ok(tui.timers.every(({ cleared }) => cleared));
  assert.deepEqual(tui.statuses.at(-1), { key: "z-chatgpt-usage", text: undefined });
});

test("always-on recovery waits for the later exhausted window and continues once without a prompt", async (t) => {
  let body = usageBody(100, 3600);
  body.rate_limit.week = quota(604800, 100, reset(3 * 86400));
  const h = await harness({ fetchImpl: async () => ({ ok: true, json: async () => body }) });
  t.after(() => h.close());
  await h.start();
  assert.equal(h.extension.commands.size, 0);
  assert.equal(h.extension.handlers.has("session_before_tree"), false);
  const entry = { type: "custom", customType: "other-extension", data: 42 };
  const event = await fail(h, failure(), { entries: [entry] });
  const pending = h.emit("agent_before_settle", event);
  await h.settle();
  assert.match(h.statuses.at(-1).text, /3d.*Esc cancels/);
  assert.equal(h.fetches.length, 2, "verification must be newer than failure");
  assert.ok(h.timers.every(({ delay }) => delay <= 60_000), "multi-day waits must never create oversized timers");
  h.key("typing");
  assert.equal(h.listeners.size, 1);
  tickCountdown(h, now + 3600_000);
  await h.settle();
  assert.equal(h.fetches.length, 2, "shorter exhausted window cannot trigger a model retry");
  body = usageBody(0, 500000, { allowed: true, limit_reached: false });
  tickCountdown(h, now + 3 * 86400_000);
  assert.deepEqual(await pending, { continue: true, entries: [entry, { type: "context_edit", targetId: "failed", replacement: null }] });
  assert.equal(h.listeners.size, 0);
  assert.equal(await h.emit("agent_before_settle", event), undefined, "candidate is consumed");
});

test("only confirmed subscription exhaustion arms a reset wait", async (t) => {
  const cases = [
    ["explicitly allowed", usageBody(100, 3600, { allowed: true, limit_reached: false }), failure()],
    ["conflicting flags", usageBody(100, 3600, { allowed: true, limit_reached: true }), failure()],
    ["malformed flags", usageBody(100, 3600, { allowed: "false" }), failure()],
    ["denied without exhausted window", usageBody(0, 3600, { allowed: false }), failure()],
    ["rounded is not exhausted", usageBody(99.6), failure()],
    ["past reset", usageBody(100, -1), failure()],
    ["missing reset", { rate_limit: { primary_window: { limit_window_seconds: 18000, used_percent: 100 } } }, failure()],
    ["malformed body", { secret: "private" }, failure()],
    ["successful prose", usageBody(), failure({ stopReason: "stop" })],
    ["other provider", usageBody(), failure({ provider: "other" })],
    ["transport failure", usageBody(), failure({ errorMessage: "connection lost" })],
    ["known transient", usageBody(), failure({ errorMessage: '{"error":{"code":"rate_limit_exceeded"}}' })],
    ["plain transient code", usageBody(), failure({ errorMessage: "rate_limit_exceeded: too many requests (429)" })],
    ["transient TPM reason", usageBody(), failure({ errorMessage: "429 rate limit reached on tokens per minute (TPM)" })],
    ["admin denial", usageBody(), failure({ errorMessage: '{"error":{"code":"usage_not_included"}}' })],
    ["billing", usageBody(), failure({ errorMessage: '{"error":{"code":"insufficient_quota"}}' })],
    ["generic 429 alone", usageBody(20), failure({ errorMessage: "429 Too Many Requests" })],
    ["auth 429", usageBody(), failure({ errorMessage: "429 invalid_api_key" })],
    ["malformed supported window", { rate_limit: { primary: quota(18000, 100, reset(3600)), secondary: quota(604800, "bad", reset(90000)) } }, failure()],
    ["duplicate supported window", { rate_limit: { primary: quota(18000, 100, reset(3600)), duplicate: quota(18000, 100, reset(90000)) } }, failure()],
  ];
  for (const [name, body, message] of cases) await t.test(name, async (t) => {
    const h = await harness({ body });
    t.after(() => h.close());
    await h.start();
    assert.equal(await h.emit("agent_before_settle", await fail(h, message)), undefined);
    assert.equal(h.listeners.size, 0);
    assert.ok(!h.statuses.some(({ text }) => text?.includes("Esc cancels")));
    assert.ok(h.notifications.every(({ text }) => !/private|secret/.test(text)));
  });
});

test("weekly-only, structured subscription, and ambiguous 429 failures require fresh corroboration", async (t) => {
  for (const message of [failure(), failure({ errorMessage: '{"error":{"code":"usage_limit_reached"}}' }), failure({ errorMessage: "429 Too Many Requests" })]) {
    const h = await harness({ body: { rate_limit: { secondary_window: quota(604800, 100, reset(90000)), allowed: false, limit_reached: true } } });
    t.after(() => h.close());
    await h.start();
    const pending = h.emit("agent_before_settle", await fail(h, message));
    await h.settle();
    assert.match(h.statuses.at(-1).text, /quota reset in 1d1h/);
    h.key("\u001b");
    assert.equal(await pending, undefined);
    assert.equal(h.listeners.size, 0);
    await h.close();
  }
});

test("each cancellation path promptly releases the boundary without consuming input", async (t) => {
  for (const name of ["escape", "input", "model_select", "session_before_switch", "session_before_fork", "session_start", "session_shutdown", "signal"]) await t.test(name, async (t) => {
    const h = await harness({ body: usageBody() });
    t.after(() => h.close());
    await h.start();
    const signal = new AbortController();
    h.ctx.signal = signal.signal;
    const pending = h.emit("agent_before_settle", await fail(h));
    await h.settle();
    assert.equal(h.listeners.size, 1);
    if (name === "escape") h.key("\u001b");
    else if (name === "signal") signal.abort();
    else assert.equal(await h.emit(name), undefined);
    assert.equal(await pending, undefined);
    assert.equal(h.listeners.size, 0);
    assert.equal(await h.emit("agent_before_settle", { outcome: "error", context: { pendingMessages: [] } }), undefined);
  });
});

test("reset verification extends only with trustworthy evidence, otherwise stops", async (t) => {
  for (const kind of ["later", "past", "unknown", "denied", "fetch failure", "unsafe context"]) await t.test(kind, async (t) => {
    let body = usageBody(100, 60), failFetch = false;
    const h = await harness({ fetchImpl: async () => {
      if (failFetch) throw new Error("private token");
      return { ok: true, json: async () => body };
    } });
    t.after(() => h.close());
    await h.start();
    const event = await fail(h);
    if (kind === "unsafe context") event.context.contextEntries[0].messages = [failure({ stopReason: "stop" })];
    const pending = h.emit("agent_before_settle", event);
    await h.settle();
    if (kind === "later") body = usageBody(100, 120);
    if (kind === "unknown") body = {};
    if (kind === "denied") body = usageBody(0, 120, { allowed: false });
    if (kind === "fetch failure") failFetch = true;
    if (kind === "unsafe context") body = usageBody(0, 120, { allowed: true });
    tickCountdown(h, now + 60_000);
    await h.settle();
    if (kind === "later") {
      assert.match(h.statuses.at(-1).text, /quota reset in 1m/);
      assert.equal(h.listeners.size, 1);
      h.key("\u001b");
    }
    assert.equal(await pending, undefined);
    assert.equal(h.listeners.size, 0);
    if (kind !== "later") {
      assert.equal(h.notifications.length, 1);
      assert.doesNotMatch(h.statuses.at(-1).text ?? "", /Esc cancels/, "stopped recovery must remove countdown even after fetch failure");
    }
  });
});

test("a pre-failure in-flight refresh cannot authorize recovery; cancelling ignores late results", async (t) => {
  let resolveFetch;
  const h = await harness({ fetchImpl: () => new Promise((resolve) => { resolveFetch = resolve; }) });
  t.after(() => h.close());
  await h.start();
  const pending = h.emit("agent_before_settle", await fail(h));
  await h.settle();
  assert.equal(h.fetches.length, 1);
  resolveFetch({ ok: true, json: async () => usageBody() });
  await h.settle();
  assert.equal(h.fetches.length, 2, "pre-failure data must be replaced");
  h.key("\u001b");
  assert.equal(await pending, undefined);
  assert.equal(h.fetches.at(-1).options.signal.aborted, true);
  resolveFetch({ ok: true, json: async () => usageBody(0, 120, { allowed: true }) });
  await h.settle();
  assert.equal(h.listeners.size, 0);
  assert.equal(await h.emit("agent_before_settle", { outcome: "error", context: { pendingMessages: [] } }), undefined);
});

async function realSession(h, { transient = false, queued = false, otherEntry = true, failures = 1, errorText } = {}) {
  const requests = [], errors = [], events = [];
  let tools = 0;
  const model = { ...h.ctx.model, api: "openai-codex-responses", name: "Synthetic", reasoning: false, input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 100000, maxTokens: 1024 };
  const usage = { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 2,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } };
  const agent = new Agent({ initialState: { model, thinkingLevel: "off" }, convertToLlm,
    streamFn: (_model, context) => {
      requests.push(structuredClone(context));
      const stream = new AssistantMessageEventStream();
      const n = requests.length, failed = n >= 2 && n < 2 + failures;
      const message = { ...failure(), usage, stopReason: failed ? "error" : n === 1 ? "toolUse" : "stop",
        errorMessage: failed ? (errorText ?? (transient ? "rate_limit_exceeded (429)" : failure().errorMessage)) : undefined,
        content: n === 1 ? [{ type: "toolCall", id: "completed-tool", name: "probe", arguments: {} }]
          : failed ? [] : [{ type: "text", text: "continued" }] };
      queueMicrotask(() => {
        stream.push({ type: "start", partial: message });
        stream.push(failed ? { type: "error", reason: "error", error: message } : { type: "done", reason: message.stopReason, message });
      });
      return stream;
    } });
  const manager = SessionManager.inMemory(process.cwd());
  const other = { type: "custom_message", customType: "other-extension", content: "retained boundary context", display: false };
  if (otherEntry) h.extension.handlers.set("agent_before_settle", [() => ({ entries: [other] }), ...h.extension.handlers.get("agent_before_settle")]);
  const resourceLoader = {
    getExtensions: () => ({ ...h.loaded, runtime: h.runtime }), getSkills: () => ({ skills: [], diagnostics: [] }),
    getPrompts: () => ({ prompts: [], diagnostics: [] }), getThemes: () => ({ themes: [], diagnostics: [] }),
    getAgentsFiles: () => ({ agentsFiles: [] }), getSystemPrompt: () => "Synthetic test only.", getSystemPromptSource: () => undefined,
    getAppendSystemPrompt: () => [], getAppendSystemPromptSources: () => [],
  };
  const session = new AgentSession({ agent, sessionManager: manager, cwd: process.cwd(), resourceLoader,
    settingsManager: SettingsManager.inMemory({ compaction: { enabled: false }, retry: { enabled: true, maxRetries: 1, baseDelayMs: 5 } }),
    modelRuntime: { getAuth: async () => ({ auth: { apiKey: jwt() } }), hasConfiguredAuth: () => true,
      getModel: () => model, getPhysicalModel: () => model, getAvailableSnapshot: () => [model],
      getRegisteredProviderIds: () => [], isUsingOAuth: () => false, isUsingSubscription: () => true },
    baseToolsOverride: { probe: { name: "probe", label: "Probe", description: "Synthetic tool", parameters: { type: "object", properties: {} },
      execute: async () => { tools++; return { content: [{ type: "text", text: "saved tool output" }], details: {} }; } } },
    initialActiveToolNames: ["probe"],
  });
  session.subscribe((event) => { events.push(event); });
  if (queued) h.extension.handlers.set("agent_end", [async () => {
    if (requests.length === 2) await session.prompt("new work", { streamingBehavior: "followUp" });
  }]);
  await session.bindExtensions({ mode: "tui", uiContext: h.ctx.ui, onError: (error) => errors.push(error) });
  return { session, manager, requests, errors, events, get tools() { return tools; } };
}

test("real AgentSession retains raw history/tools and composes boundary entries for one continuation", async (t) => {
  let body = usageBody(100, 60);
  const h = await harness({ fetchImpl: async () => ({ ok: true, json: async () => body }) });
  const r = await realSession(h);
  t.after(async () => { await h.close(); r.session.dispose(); });
  const pending = r.session.prompt("original prompt");
  await h.settle();
  assert.equal(r.requests.length, 2);
  assert.equal(h.listeners.size, 1);
  assert.equal(r.events.filter(({ type }) => type === "agent_settled").length, 0);
  body = usageBody(0, 3600, { allowed: true });
  tickCountdown(h, now + 60_000);
  await pending;
  assert.deepEqual(r.errors, []);
  assert.equal(r.requests.length, 3);
  assert.equal(r.tools, 1, "completed tool must not replay");
  const messages = r.requests[2].messages;
  assert.equal(messages.filter((message) => message.role === "user" && message.content.some((part) => part.text === "original prompt")).length, 1);
  assert.ok(messages.some((message) => message.role === "toolResult" && message.content[0].text === "saved tool output"));
  assert.ok(messages.some((message) => message.role === "user" && message.content[0].text === "retained boundary context"));
  assert.ok(!messages.some((message) => message.stopReason === "error"));
  const raw = r.manager.getBranch();
  assert.equal(raw.filter((entry) => entry.type === "message" && entry.message.stopReason === "error").length, 1);
  assert.equal(raw.filter((entry) => entry.type === "context_edit" && entry.replacement === null).length, 1);
  assert.equal(h.listeners.size, 0);
});

test("real AgentSession exhausts native retry budget before quota recovery, without another extension's context", async (t) => {
  let body = usageBody(100, 60);
  const h = await harness({ fetchImpl: async () => ({ ok: true, json: async () => body }) });
  const r = await realSession(h, { failures: 2, errorText: "429 Too Many Requests", otherEntry: false });
  t.after(async () => { await h.close(); r.session.dispose(); });
  const pending = r.session.prompt("original prompt");
  await h.settle();
  assert.equal(r.requests.length, 2);
  assert.equal(h.listeners.size, 0);
  h.timers.find(({ kind, delay, cleared }) => kind === "timeout" && delay === 5 && !cleared).callback();
  await h.settle();
  assert.equal(r.requests.length, 3);
  assert.equal(h.listeners.size, 1);
  assert.equal(r.events.filter(({ type }) => type === "auto_retry_start").length, 1);
  body = usageBody(0, 3600);
  tickCountdown(h, now + 60_000);
  await pending;
  assert.equal(r.requests.length, 4);
  assert.equal(r.tools, 1);
  assert.equal(r.requests[3].messages.at(-1).role, "toolResult");
  assert.equal(r.requests[3].messages.filter(({ role }) => role === "user").length, 1);
  assert.equal(r.manager.getBranch().filter((entry) => entry.type === "message" && entry.message.stopReason === "error").length, 2);
  assert.deepEqual(r.errors, []);
});

test("real AgentSession native abort before tree navigation waits for Escape without continuation", async (t) => {
  const h = await harness({ body: usageBody() });
  const r = await realSession(h);
  t.after(async () => { h.key("\u001b"); await h.close(); r.session.dispose(); });
  let promptFinished = false, abortFinished = false, navigationStarted = false, finished = false;
  const pending = r.session.prompt("original prompt").then(() => { promptFinished = true; });
  await h.settle();
  assert.equal(h.listeners.size, 1);
  assert.match(h.statuses.at(-1).text, /quota reset in .*Esc cancels/);
  const leaf = r.manager.getLeafId();
  const target = r.manager.getBranch().find((entry) => entry.type === "message" && entry.message.role === "toolResult");
  assert.ok(target);
  assert.notEqual(target.id, leaf);
  // shortcut: native tree navigation waits on recovery; press Escape first until Pi exposes pre-abort cancellation.
  const navigation = (async () => {
    await r.session.abort();
    abortFinished = true;
    navigationStarted = true;
    return r.session.navigateTree(target.id, { summarize: false });
  })();
  const completion = Promise.allSettled([pending, navigation]).then((results) => { finished = true; return results; });
  await h.settle();
  assert.equal(abortFinished, false);
  assert.equal(navigationStarted, false);
  assert.equal(promptFinished, false);
  assert.equal(finished, false);
  assert.equal(r.manager.getLeafId(), leaf);
  assert.equal(r.session.isStreaming, true);
  assert.equal(h.listeners.size, 1);
  assert.match(h.statuses.at(-1).text, /quota reset in .*Esc cancels/);
  assert.equal(r.requests.length, 2);
  h.key("\u001b");
  await h.settle();
  assert.equal(finished, true, "Escape must release abort, prompt, and actual navigation within bounded observation");
  const [promptResult, navigationResult] = await completion;
  assert.equal(promptResult.status, "fulfilled");
  assert.equal(navigationResult.status, "fulfilled");
  assert.equal(navigationResult.value.cancelled, false);
  assert.equal(abortFinished, true);
  assert.equal(navigationStarted, true);
  assert.equal(promptFinished, true);
  assert.equal(r.manager.getLeafId(), target.id);
  assert.deepEqual(r.errors, []);
  assert.equal(r.requests.length, 2);
  assert.equal(h.listeners.size, 0);
  assert.doesNotMatch(h.statuses.at(-1).text ?? "", /Esc cancels/);
  assert.equal(r.session.isStreaming, false);
});

test("real AgentSession performs native transient retry before settlement and never reset-waits", async (t) => {
  const h = await harness({ body: usageBody() });
  const r = await realSession(h, { transient: true });
  t.after(async () => { await h.close(); r.session.dispose(); });
  const pending = r.session.prompt("original prompt");
  await h.settle();
  assert.equal(h.listeners.size, 0);
  const retry = h.timers.find(({ kind, delay, cleared }) => kind === "timeout" && delay === 5 && !cleared);
  assert.ok(retry, "native configured retry delay is retained");
  retry.callback();
  await pending;
  assert.equal(r.requests.length, 3);
  assert.deepEqual(r.errors, []);
  assert.ok(!h.statuses.some(({ text }) => text?.includes("Esc cancels")));
});

test("structured transient reason takes precedence over the adapter's ambiguous friendly message", async (t) => {
  const h = await harness({ body: usageBody() });
  t.after(() => h.close());
  await h.start();
  const event = await fail(h);
  await h.emit("provider_stream_event", { provider: "openai-codex", model: "test-model", data: { type: "response.failed", response: { error: { code: "rate_limit_exceeded" } } } });
  await h.emit("turn_end", { message: failure(), messageEntryId: "failed" });
  assert.equal(await h.emit("agent_before_settle", event), undefined);
  assert.equal(h.fetches.length, 1);
});

test("replacement ownership and successful turns invalidate candidates", async (t) => {
  for (const change of ["model", "session", "branch", "success", "aborted", "queued"]) await t.test(change, async (t) => {
    const h = await harness({ body: usageBody() });
    t.after(() => h.close());
    await h.start();
    const event = await fail(h);
    if (change === "model") h.ctx.model = { provider: "openai-codex", id: "replacement" };
    if (change === "session") h.setSession("replacement");
    if (change === "branch") h.setBranch([]);
    if (change === "success") await h.emit("turn_end", { message: failure({ stopReason: "stop" }), messageEntryId: "success" });
    if (change === "aborted") event.outcome = "aborted";
    if (change === "queued") event.context.pendingMessages = [{ role: "user", content: "new work" }];
    assert.equal(await h.emit("agent_before_settle", event), undefined);
    assert.equal(h.fetches.length, 1);
    assert.equal(h.listeners.size, 0);
  });
});

test("non-TUI sessions never capture failures or start recovery", async (t) => {
  for (const mode of ["rpc", "print", "json"]) {
    const h = await harness({ mode, body: usageBody() });
    t.after(() => h.close());
    await h.start();
    assert.equal(await h.emit("agent_before_settle", await fail(h)), undefined);
    assert.equal(h.fetches.length, 0);
    assert.equal(h.timers.length, 0);
    assert.equal(h.listeners.size, 0);
    await h.close();
  }
});

test("cancelling during credentials lookup cannot launch a late verification request", async (t) => {
  const h = await harness({ body: usageBody() });
  t.after(() => h.close());
  await h.start();
  let resolveToken;
  h.ctx.modelRegistry.getApiKeyForProvider = () => new Promise((resolve) => { resolveToken = resolve; });
  const pending = h.emit("agent_before_settle", await fail(h));
  await h.settle();
  h.key("\u001b");
  assert.equal(await pending, undefined);
  resolveToken(jwt());
  await h.settle();
  assert.equal(h.fetches.length, 1);
  assert.equal(h.listeners.size, 0);
  assert.ok(h.timers.every(({ kind, cleared }) => kind !== "timeout" || cleared));
});

test("real AgentSession newly submitted work releases the wait and is delivered once", async (t) => {
  const h = await harness({ body: usageBody() });
  const r = await realSession(h);
  t.after(async () => { await h.close(); r.session.dispose(); });
  const pending = r.session.prompt("original prompt");
  await h.settle();
  assert.equal(h.listeners.size, 1);
  await r.session.prompt("new work", { streamingBehavior: "steer" });
  await pending;
  assert.equal(r.requests.length, 3);
  assert.equal(h.listeners.size, 0);
  assert.deepEqual(r.errors, []);
  assert.equal(r.manager.getBranch().filter((entry) => entry.type === "message" && entry.message.role === "user" && entry.message.content[0].text === "new work").length, 1);
});

test("real AgentSession queued user work supersedes quota failure", async (t) => {
  const h = await harness({ body: usageBody() });
  const r = await realSession(h, { queued: true });
  t.after(async () => { await h.close(); r.session.dispose(); });
  await r.session.prompt("original prompt");
  assert.equal(r.requests.length, 3);
  assert.equal(h.listeners.size, 0);
  assert.deepEqual(r.errors, []);
  assert.equal(r.manager.getBranch().filter((entry) => entry.type === "message" && entry.message.role === "user").length, 2);
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { homedir, userInfo } from "node:os";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const extensionPath = resolve(fileURLToPath(new URL("..", import.meta.url)), "usage.ts");
const install = join(homedir(), ".pi/agent/install");
const piRoot = process.env.PI_TEST_PACKAGE_ROOT ?? join(install, "releases", readFileSync(join(install, "current-version"), "utf8").trim(), "node_modules/@earendil-works/pi-coding-agent");
const { loadExtensions, loadExtensionFromFactory, createExtensionRuntime } = await import(pathToFileURL(join(piRoot, "dist/core/extensions/loader.js")));
const { createJiti } = createRequire(join(piRoot, "package.json"))("jiti");
const importExtension = createJiti(import.meta.url, { alias: {
  "@earendil-works/pi-coding-agent": join(piRoot, "dist/index.js"),
  "@earendil-works/pi-tui": join(piRoot, "../pi-tui/dist/index.js"),
} });
const { createEventBus } = await import(pathToFileURL(join(piRoot, "dist/core/event-bus.js")));
const { AgentSession, SessionManager, SettingsManager, convertToLlm } = await import(pathToFileURL(join(piRoot, "dist/index.js")));
const { Agent } = await import(pathToFileURL(join(piRoot, "../pi-agent-core/dist/index.js")));
const { AssistantMessageEventStream } = await import(pathToFileURL(join(piRoot, "../pi-ai/dist/utils/event-stream.js")));
const now = 1_700_000_000_000;
const reset = (seconds) => now / 1000 + seconds;
const iso = (seconds) => new Date(reset(seconds) * 1000).toISOString();
const usageBody = (used = 100, seconds = 3600, week) => ({ five_hour: { utilization: used, resets_at: iso(seconds) },
  ...(week ? { seven_day: { utilization: week[0], resets_at: iso(week[1]) } } : {}) });
const keychain = async () => ({ code: 0, stdout: JSON.stringify({ claudeAiOauth: { accessToken: "private-token" } }) });

function assertQuotaBars(text, expectedRemaining) {
  const cells = [...text.matchAll(/<[^:]+:([█░]+)>/g)].map(([, value]) => value).join("");
  const bars = cells.match(/[█░]{8}/g) ?? [];
  assert.equal(bars.length, expectedRemaining.length);
  bars.forEach((bar, index) => {
    assert.equal([...bar].filter((cell) => cell === "█").length, expectedRemaining[index]);
    assert.equal([...bar].filter((cell) => cell === "░").length, 8 - expectedRemaining[index]);
  });
}

async function harness({ mode = "tui", provider = "claude-code", providerEnv = { PI_CLAUDE_CODE_CONFIG_DIR: join(homedir(), ".claude") },
  execImpl = keychain, body, fetchImpl, nowMs = now } = {}) {
  const runtime = createExtensionRuntime(), bus = createEventBus(), statuses = [], fetches = [], timers = [];
  const listeners = new Set(), notifications = [];
  let branch = [], sessionId = "session-one";
  assert.deepEqual((await loadExtensions([extensionPath], process.cwd(), bus, runtime)).errors, [], "Pi must accept the usage extension");
  const factory = await importExtension.import(extensionPath, { default: true });
  const loaded = { extensions: [await loadExtensionFromFactory((api) => factory({ ...api, exec: execImpl }), process.cwd(), bus, runtime)], errors: [] };
  assert.deepEqual(loaded.errors, [], "Pi must accept the usage extension");
  const extension = loaded.extensions[0];
  const previous = {
    fetch: globalThis.fetch, setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout,
    setInterval: globalThis.setInterval, clearInterval: globalThis.clearInterval, now: Date.now, tmp: process.env.TMPDIR,
  };
  const cacheRoot = process.env.TMPDIR = mkdtempSync(join(tmpdir(), "usage-test-"));
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
    model: { provider, id: "test-model" },
    sessionManager: {
      getSessionId: () => sessionId,
      getLeafId: () => branch.at(-1)?.id,
      getBranch: () => branch,
    },
    modelRegistry: {
      getProviderAuth: async (provider) => { assert.equal(provider, "claude-code"); return { env: providerEnv }; },
    },
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
    statuses, fetches, timers, emit, settle, ctx, cacheRoot, listeners, notifications, extension, loaded, runtime,
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
      if (previous.tmp === undefined) delete process.env.TMPDIR; else process.env.TMPDIR = previous.tmp;
      rmSync(cacheRoot, { recursive: true, force: true });
      runtime.invalidate(); bus.clear();
    },
  };
}

// Synthetic fixtures follow the installed adapter shape, not an observed quota incident.
const failure = (extra = {}) => ({ role: "assistant", provider: "claude-code", model: "test-model", api: "claude-code",
  content: [], stopReason: "error", errorMessage: "Claude Code API error: You've hit your usage limit · resets 3pm", timestamp: now, ...extra });

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
  const h = await harness({ body: usageBody(24.6, 9000, [9.6, 2 * 86400 + 3 * 3600]) });
  t.after(() => h.close());
  await h.start();
  assert.equal(h.fetches.length, 1);
  assert.deepEqual(h.statuses.at(-1), {
    key: "z-usage",
    text: "<text:75%> <accent:██████><muted:░░><muted: ↻2h30m><dim: │ ><text:90%> <mdLink:███████><muted:░><muted: ↻2d3h>",
  });
  assertQuotaBars(h.statuses.at(-1).text, [6, 7]);
  assert.doesNotMatch(h.statuses.at(-1).text, /Claude|private-token/);
  const [refresh, countdown] = h.timers.filter(({ kind, delay }) => kind === "interval" && delay === 60_000);
  assert.ok(refresh);
  assert.ok(countdown);
  h.setNow(now + 60_000);
  countdown.callback();
  await h.settle();
  assert.match(h.statuses.at(-1).text, /↻2h29m/);
  assert.equal(h.fetches.length, 1, "countdown ticks do not refresh quota early");
});

test("Claude Personal and VO2 read only their own Keychain item and render their quota", async (t) => {
  for (const [dir, label, used] of [[".claude", "Personal", 25], [".claude-vo2", "VO2", 80]]) {
    const configDir = join(homedir(), dir), calls = [];
    const h = await harness({ provider: "claude-code",
      providerEnv: { PI_CLAUDE_CODE_CONFIG_DIR: configDir, CLAUDE_SECURESTORAGE_CONFIG_DIR: undefined },
      execImpl: async (command, args, options) => {
        calls.push({ command, args, options });
        return { code: 0, stdout: JSON.stringify({ claudeAiOauth: { accessToken: `private-${label}` } }) };
      }, body: {
        five_hour: { utilization: used, resets_at: new Date(reset(3600) * 1000).toISOString() },
        seven_day: { utilization: 95, resets_at: new Date(reset(86400) * 1000).toISOString() },
      } });
    t.after(() => h.close());
    await h.start();
    assert.equal(calls.length, 1);
    assert.equal(calls[0].command, "/usr/bin/security");
    const suffix = createHash("sha256").update(configDir).digest("hex").slice(0, 8);
    assert.deepEqual(calls[0].args, ["find-generic-password", "-a", userInfo().username, "-s", `Claude Code-credentials-${suffix}`, "-w"]);
    assert.equal(calls[0].options.timeout, 10_000);
    assert.equal(h.fetches.length, 1);
    assert.equal(h.fetches[0].url, "https://api.anthropic.com/api/oauth/usage");
    assert.equal(h.fetches[0].options.headers.Authorization, `Bearer private-${label}`);
    assert.equal(h.fetches[0].options.headers["anthropic-beta"], "oauth-2025-04-20");
    assert.equal(h.fetches[0].options.redirect, "error");
    assert.match(h.statuses.at(-1).text, new RegExp(`${100 - used}%.*↻1h.*5%.*↻1d`));
    assert.doesNotMatch(h.statuses.at(-1).text, /Claude/);
    assert.doesNotMatch(h.statuses.at(-1).text, /private-/);
    await h.close();
  }
});

test("a missing or logged-out Claude profile never falls back to another account", async (t) => {
  for (const result of [
    { code: 44, stderr: "private credential error" },
    { code: 0, stdout: JSON.stringify({ claudeAiOauth: { accessToken: "" } }) },
  ]) {
    let calls = 0;
    const h = await harness({ provider: "claude-code",
      providerEnv: { PI_CLAUDE_CODE_CONFIG_DIR: join(homedir(), ".claude-vo2") },
      execImpl: async () => { calls++; return result; } });
    t.after(() => h.close());
    await h.start();
    assert.equal(calls, 1);
    assert.equal(h.fetches.length, 0);
    assert.equal(h.statuses.at(-1).text, "<muted:Claude VO2 unavailable>");
    await h.close();
  }
});

test("Claude request failure clears old quota without exposing credentials", async (t) => {
  let ok = true;
  const h = await harness({ provider: "claude-code",
    providerEnv: { PI_CLAUDE_CODE_CONFIG_DIR: join(homedir(), ".claude") },
    execImpl: async () => ({ code: 0, stdout: JSON.stringify({ claudeAiOauth: { accessToken: "private-token" } }) }),
    fetchImpl: async () => ({ ok, json: async () => ({
      five_hour: { utilization: 25, resets_at: new Date(reset(60) * 1000).toISOString() },
    }) }) });
  t.after(() => h.close());
  await h.start();
  assert.match(h.statuses.at(-1).text, /^(?!.*Claude).*75%/);
  ok = false;
  h.setNow(now + 60_000);
  h.timers.find(({ kind, delay }) => kind === "interval" && delay === 60_000).callback();
  await h.settle();
  assert.equal(h.statuses.at(-1).text, "<muted:Claude Personal unavailable>");
  assert.ok(!JSON.stringify(h.statuses).includes("private-token"));
});

test("Claude usage rate limiting keeps the last known quota", async (t) => {
  let status = 200;
  const h = await harness({ provider: "claude-code",
    providerEnv: { PI_CLAUDE_CODE_CONFIG_DIR: join(homedir(), ".claude") },
    execImpl: async () => ({ code: 0, stdout: JSON.stringify({ claudeAiOauth: { accessToken: "private-token" } }) }),
    fetchImpl: async () => ({ ok: status === 200, status, json: async () => ({
      five_hour: { utilization: 25, resets_at: new Date(reset(3600) * 1000).toISOString() },
    }) }) });
  t.after(() => h.close());
  await h.start();
  status = 429;
  h.setNow(now + 60_000);
  h.timers.find(({ kind, delay }) => kind === "interval" && delay === 60_000).callback();
  await h.settle();
  assert.match(h.statuses.at(-1).text, /^(?!.*Claude).*75%/);
  assert.equal(h.fetches.length, 2);

  // Another session starting during the shared backoff shows the cached quota without calling the endpoint.
  const second = await harness({ provider: "claude-code",
    providerEnv: { PI_CLAUDE_CODE_CONFIG_DIR: join(homedir(), ".claude") },
    execImpl: async () => ({ code: 0, stdout: JSON.stringify({ claudeAiOauth: { accessToken: "private-token" } }) }),
    fetchImpl: async () => { throw new Error("must not fetch during backoff"); }, nowMs: now + 120_000 });
  process.env.TMPDIR = h.cacheRoot;
  await second.start();
  assert.equal(second.fetches.length, 0);
  assert.match(second.statuses.at(-1).text, /^(?!.*Claude).*75%/);
  await second.close();
});

test("switching providers clears old quota immediately and ignores late responses", async (t) => {
  let resolveFetch;
  const h = await harness({ fetchImpl: () => new Promise((resolve) => { resolveFetch = resolve; }) });
  t.after(() => h.close());
  await h.start();
  const signal = h.fetches[0].options.signal;
  h.ctx.model = { provider: "other", id: "other" };
  await h.emit("model_select");
  assert.equal(signal.aborted, true);
  assert.equal(h.statuses.at(-1).text, undefined);
  resolveFetch({ ok: true, json: async () => usageBody(80) });
  await h.settle();
  assert.equal(h.statuses.at(-1).text, undefined);
  h.ctx.model = { provider: "claude-code", id: "test-model" };
  await h.emit("model_select");
  await h.settle();
  assert.equal(h.fetches.length, 2);
  resolveFetch({ ok: true, json: async () => usageBody(20) });
  await h.settle();
  assert.match(h.statuses.at(-1).text, /80%/);
});

test("renders fully remaining and fully used quota bars", async (t) => {
  const h = await harness({ body: usageBody(0, 0, [100, 0]) });
  t.after(() => h.close());
  await h.start();
  assert.equal(h.statuses.at(-1).text,
    "<text:100%> <accent:████████><muted: ↻0m><dim: │ ><warning:0%> <muted:░░░░░░░░><muted: ↻0m>");
  assertQuotaBars(h.statuses.at(-1).text, [8, 0]);
});

test("warns at exactly 10% remaining and mutes the spent cells", async (t) => {
  const h = await harness({ body: usageBody(90, 0) });
  t.after(() => h.close());
  await h.start();
  assert.equal(h.statuses.at(-1).text,
    "<warning:10%> <warning:█><muted:░░░░░░░><muted: ↻0m>");
  assertQuotaBars(h.statuses.at(-1).text, [1]);
});

test("omits malformed or missing windows instead of guessing their duration", async (t) => {
  const h = await harness({ body: usageBody(101, 5000, [70, 180000]) });
  t.after(() => h.close());
  await h.start();
  assert.equal(h.statuses.at(-1).text, "<text:30%> <mdLink:██><muted:░░░░░░><muted: ↻2d2h>");
  assertQuotaBars(h.statuses.at(-1).text, [2]);

  await h.close();
  const missing = await harness({ body: { five_hour: { utilization: "bad", resets_at: iso(5000) }, seven_day: null } });
  t.after(() => missing.close());
  await missing.start();
  assert.deepEqual(missing.statuses.at(-1), { key: "z-usage", text: "<muted:Claude Personal unavailable>" });
});

test("network, HTTP, and JSON failures show only a generic unavailable status", async (t) => {
  for (const fetchImpl of [
    async () => { throw new Error("private access token and account claim"); },
    async () => ({ ok: false, json: async () => ({ secret: "provider response" }) }),
    async () => ({ ok: true, json: async () => { throw new Error("private response body"); } }),
  ]) {
    const h = await harness({ fetchImpl });
    t.after(() => h.close());
    await h.start();
    const text = h.statuses.at(-1).text;
    assert.equal(text, "<muted:Claude Personal unavailable>");
    assert.equal(h.statuses.at(-1).key, "z-usage");
    assert.doesNotMatch(text, /private|secret|provider response/);
    const [, countdown] = h.timers.filter(({ kind, delay }) => kind === "interval" && delay === 60_000);
    assert.ok(countdown);
    countdown.callback();
    await h.settle();
    assert.deepEqual(h.statuses.at(-1), { key: "z-usage", text: "<muted:Claude Personal unavailable>" });
    assert.equal(h.fetches.length, 1, "countdown ticks do not trigger an early retry");
  }
});

test("clears stale quota on failure and replaces unavailable status after the next refresh", async (t) => {
  const body = usageBody(25, 5000);
  let requests = 0;
  const h = await harness({ fetchImpl: async () => {
    requests++;
    if (requests === 2) return { ok: false, json: async () => ({}) };
    return { ok: true, json: async () => body };
  } });
  t.after(() => h.close());
  await h.start();
  assert.match(h.statuses.at(-1).text, /<text:75%> <accent:██████>/);

  const [refresh, countdown] = h.timers.filter(({ kind, delay }) => kind === "interval" && delay === 60_000);
  assert.ok(refresh && countdown);
  h.setNow(now + 60_000);
  refresh.callback();
  await h.settle();
  assert.deepEqual(h.statuses.at(-1), { key: "z-usage", text: "<muted:Claude Personal unavailable>" });
  countdown.callback();
  await h.settle();
  assert.deepEqual(h.statuses.at(-1), { key: "z-usage", text: "<muted:Claude Personal unavailable>" });
  assert.equal(h.fetches.length, 2, "countdown ticks do not trigger an early retry");

  h.setNow(now + 120_000);
  refresh.callback();
  await h.settle();
  assert.match(h.statuses.at(-1).text, /<text:75%> <accent:██████>/);
  assert.equal(h.fetches.length, 3);
});

test("does not fetch or start timers outside TUI; shutdown aborts and clears TUI work", async (t) => {
  const rpc = await harness({ mode: "rpc", body: usageBody() });
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
  assert.deepEqual(tui.statuses.at(-1), { key: "z-usage", text: "<muted:Claude Personal unavailable>" });
  await tui.emit("session_shutdown");
  assert.ok(tui.timers.every(({ cleared }) => cleared));
  assert.deepEqual(tui.statuses.at(-1), { key: "z-usage", text: undefined });
});

test("always-on recovery waits for the later exhausted window and continues once without a prompt", async (t) => {
  const h = await harness({ body: usageBody(100, 3600, [100, 3 * 86400]) });
  t.after(() => h.close());
  await h.start();
  assert.equal(h.extension.commands.size, 0);
  assert.equal(h.extension.handlers.has("session_before_tree"), false);
  const entry = { type: "custom", customType: "other-extension", data: 42 };
  const event = await fail(h, failure(), { entries: [entry] });
  const pending = h.emit("agent_before_settle", event);
  await h.settle();
  assert.match(h.statuses.at(-1).text, /3d.*Esc cancels/);
  assert.ok(h.timers.every(({ delay }) => delay <= 60_000), "multi-day waits must never create oversized timers");
  h.key("typing");
  assert.equal(h.listeners.size, 1);
  h.timers.filter(({ kind, delay }) => kind === "interval" && delay === 60_000)[0].cleared = true;
  tickCountdown(h, now + 3600_000);
  await h.settle();
  assert.equal(h.listeners.size, 1, "shorter exhausted window cannot trigger a model retry");
  tickCountdown(h, now + 3 * 86400_000);
  assert.deepEqual(await pending, { continue: true, entries: [entry, { type: "context_edit", targetId: "failed", replacement: null }] });
  assert.equal(h.listeners.size, 0);
  assert.equal(await h.emit("agent_before_settle", event), undefined, "candidate is consumed");
});

test("only Claude usage-limit failures arm a reset wait", async (t) => {
  const cases = [
    ["successful prose", failure({ stopReason: "stop" })],
    ["other provider", failure({ provider: "other" })],
    ["transport failure", failure({ errorMessage: "connection lost" })],
    ["server error", failure({ errorMessage: "Claude Code upstream server error (status 529)" })],
    ["plain 429", failure({ errorMessage: "429 Too Many Requests" })],
  ];
  for (const [name, message] of cases) await t.test(name, async (t) => {
    const h = await harness({ body: usageBody() });
    t.after(() => h.close());
    await h.start();
    assert.equal(await h.emit("agent_before_settle", await fail(h, message)), undefined);
    assert.equal(h.listeners.size, 0);
    assert.ok(!h.statuses.some(({ text }) => text?.includes("Esc cancels")));
    assert.ok(h.notifications.every(({ text }) => !/private|secret/.test(text)));
  });
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

test("an unsafe context stops recovery after the reset instead of continuing", async (t) => {
  const h = await harness({ body: usageBody(100, 60) });
  t.after(() => h.close());
  await h.start();
  const event = await fail(h);
  event.context.contextEntries[0].messages = [failure({ stopReason: "stop" })];
  const pending = h.emit("agent_before_settle", event);
  await h.settle();
  tickCountdown(h, now + 60_000);
  assert.equal(await pending, undefined);
  assert.equal(h.listeners.size, 0);
  assert.equal(h.notifications.length, 1);
  assert.doesNotMatch(h.statuses.at(-1).text ?? "", /Esc cancels/);
});

async function realSession(h, { transient = false, queued = false, otherEntry = true, failures = 1, errorText } = {}) {
  const requests = [], errors = [], events = [];
  let tools = 0;
  const model = { ...h.ctx.model, api: "claude-code", name: "Synthetic", reasoning: false, input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 100000, maxTokens: 1024 };
  const usage = { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 2,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } };
  const agent = new Agent({ initialState: { model, thinkingLevel: "off" }, convertToLlm,
    streamFn: (_model, context) => {
      requests.push(structuredClone(context));
      const stream = new AssistantMessageEventStream();
      const n = requests.length, failed = n >= 2 && n < 2 + failures;
      const message = { ...failure({ provider: model.provider, api: model.api }), usage, stopReason: failed ? "error" : n === 1 ? "toolUse" : "stop",
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
    modelRuntime: { getAuth: async () => ({ auth: { apiKey: "synthetic" } }), hasConfiguredAuth: () => true,
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
  body = usageBody(0, 3600);
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

test("replacement ownership and successful turns invalidate candidates", async (t) => {
  for (const change of ["model", "session", "branch", "success", "aborted", "queued"]) await t.test(change, async (t) => {
    const h = await harness({ body: usageBody() });
    t.after(() => h.close());
    await h.start();
    const event = await fail(h);
    if (change === "model") h.ctx.model = { provider: "claude-code", id: "replacement" };
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

const claudeAccountLimitError = "Incomplete Claude Code upstream response (status 429, capture incomplete, upstream said: This request would exceed your account's rate limit. Please try again later.)";

test("Claude account-limit 429 waits immediately instead of using native retries", async (t) => {
  let used = 100;
  const h = await harness({ provider: "claude-code",
    providerEnv: { PI_CLAUDE_CODE_CONFIG_DIR: join(homedir(), ".claude") },
    execImpl: async () => ({ code: 0, stdout: JSON.stringify({ claudeAiOauth: { accessToken: "private" } }) }),
    fetchImpl: async () => ({ ok: true, json: async () => ({
      five_hour: { utilization: used, resets_at: new Date(reset(3600) * 1000).toISOString() },
    }) }) });
  const r = await realSession(h, { errorText: claudeAccountLimitError, otherEntry: false });
  t.after(async () => { h.key("\u001b"); await h.close(); r.session.dispose(); });
  const pending = r.session.prompt("original prompt");
  await h.settle();
  assert.equal(r.requests.length, 2);
  assert.equal(h.listeners.size, 1);
  assert.match(h.statuses.at(-1).text, /Claude Personal quota reset in 1h/);
  assert.equal(r.events.filter(({ type }) => type === "auto_retry_start").length, 0);
  const failed = r.manager.getBranch().find((entry) => entry.type === "message" && entry.message.stopReason === "error");
  assert.ok(failed.message.errorMessage.includes(claudeAccountLimitError), "retain original diagnostics");
  tickCountdown(h, now + 60_000);
  await h.settle();
  assert.equal(r.requests.length, 2, "no model requests before reset");
  used = 0;
  tickCountdown(h, now + 3600_000);
  await pending;
  assert.equal(r.requests.length, 3);
  assert.equal(r.tools, 1);
  assert.deepEqual(r.errors, []);
});

test("Claude 429 waits for the fullest window reported by Claude Code, without the usage endpoint", async (t) => {
  const h = await harness({ provider: "claude-code",
    execImpl: async () => ({ code: 0, stdout: JSON.stringify({ claudeAiOauth: { accessToken: "private" } }) }),
    fetchImpl: async () => ({ ok: false, status: 429 }) });
  t.after(() => h.close());
  await h.start();
  const fetches = h.fetches.length;
  const ok = { id: "ok", type: "message", message: { role: "assistant", diagnostics: [{ type: "claude-code.rate-limit", details: {
    unifiedWindows: { five_hour: { utilization: 0.99, resetsAt: reset(3600) }, seven_day: { utilization: 0.8, resetsAt: reset(86400) } } } }] } };
  const event = await fail(h, failure({ provider: "claude-code", errorMessage: claudeAccountLimitError }));
  const { message } = await h.emit("message_end", { message: event.context.contextEntries[1].messages[0] });
  assert.match(message.errorMessage, /^Claude Code billing: .*status 429/);
  await h.emit("turn_end", { message, messageEntryId: "failed" });
  h.setBranch([ok, ...event.context.contextEntries.map(({ sourceEntry }) => sourceEntry)]);
  const pending = h.emit("agent_before_settle", event);
  await h.settle();
  assert.match(h.statuses.at(-1).text, /quota reset in 1h/);
  tickCountdown(h, now + 3600_000);
  assert.deepEqual(await pending, { continue: true, entries: [{ type: "context_edit", targetId: "failed", replacement: null }] });
  assert.equal(h.fetches.length, fetches, "recovery never calls the usage endpoint");
});

test("Claude usage-limit failures wait for the reset, then continue once", async (t) => {
  const claudeBody = (used, seconds) => ({
    five_hour: { utilization: used, resets_at: new Date(reset(seconds) * 1000).toISOString() },
    seven_day: { utilization: 40, resets_at: new Date(reset(86400) * 1000).toISOString() },
  });
  const claudeFailure = (errorMessage) => failure({ provider: "claude-code", api: "claude-code", errorMessage });
  const claudeHarness = (fetchImpl) => harness({ provider: "claude-code", fetchImpl,
    providerEnv: { PI_CLAUDE_CODE_CONFIG_DIR: join(homedir(), ".claude-vo2") },
    execImpl: async () => ({ code: 0, stdout: JSON.stringify({ claudeAiOauth: { accessToken: "private" } }) }) });

  for (const errorMessage of [
    "Claude Code API error: You've hit your usage limit · resets 3pm",
    "Claude Code billing: Anthropic did not accept this request on your Claude plan limits ...",
  ]) await t.test(errorMessage, async (t) => {
    let body = claudeBody(100, 3600);
    const h = await claudeHarness(async () => ({ ok: true, json: async () => body }));
    t.after(() => h.close());
    await h.start();
    const pending = h.emit("agent_before_settle", await fail(h, claudeFailure(errorMessage)));
    await h.settle();
    assert.match(h.statuses.at(-1).text, /Claude VO2 quota reset in 1h · Esc cancels/);
    body = claudeBody(0, 18000);
    tickCountdown(h, now + 3600_000);
    assert.deepEqual(await pending, { continue: true, entries: [{ type: "context_edit", targetId: "failed", replacement: null }] });
  });

  for (const [name, errorMessage, used] of [
    ["unrelated error", "Claude Code upstream server error (status 529)", 100],
  ]) await t.test(name, async (t) => {
    const h = await claudeHarness(async () => ({ ok: true, json: async () => claudeBody(used, 3600) }));
    t.after(() => h.close());
    await h.start();
    assert.equal(await h.emit("agent_before_settle", await fail(h, claudeFailure(errorMessage))), undefined);
    assert.ok(!h.statuses.some(({ text }) => text?.includes("Esc cancels")));
  });
});

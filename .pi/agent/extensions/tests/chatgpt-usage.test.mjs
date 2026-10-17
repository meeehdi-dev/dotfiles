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
    modelRegistry: { getApiKeyForProvider: async (provider) => { assert.equal(provider, "openai-codex"); return token; } },
    ui: {
      theme: { fg: (color, text) => `<${color}:${text}>` },
      setStatus: (key, text) => statuses.push({ key, text }),
    },
  };
  const emit = async (name) => {
    for (const handler of extension.handlers.get(name) ?? []) await handler({ type: name }, ctx);
  };
  const settle = async () => { for (let i = 0; i < 5; i++) await new Promise((resolve) => setImmediate(resolve)); };
  return {
    statuses, fetches, timers, emit, settle,
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
  assert.ok(h.timers.some(({ kind, delay }) => kind === "interval" && delay === 300_000));
  const countdown = h.timers.find(({ kind, delay }) => kind === "interval" && delay === 60_000);
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
    const countdown = h.timers.find(({ kind, delay }) => kind === "interval" && delay === 60_000);
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

  const refresh = h.timers.find(({ kind, delay }) => kind === "interval" && delay === 300_000);
  const countdown = h.timers.find(({ kind, delay }) => kind === "interval" && delay === 60_000);
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
  const refresh = tui.timers.find(({ kind, delay }) => kind === "interval" && delay === 300_000);
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

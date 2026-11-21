import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const install = join(homedir(), ".pi/agent/install");
const piRoot = process.env.PI_TEST_PACKAGE_ROOT ?? join(install, "releases", readFileSync(join(install, "current-version"), "utf8").trim(), "node_modules/@earendil-works/pi-coding-agent");
const { loadExtensions, createExtensionRuntime } = await import(pathToFileURL(join(piRoot, "dist/core/extensions/loader.js")));
const { createEventBus } = await import(pathToFileURL(join(piRoot, "dist/core/event-bus.js")));
const path = fileURLToPath(new URL("../web-search.ts", import.meta.url));
const loaded = await loadExtensions([path], process.cwd(), createEventBus(), createExtensionRuntime());
assert.deepEqual(loaded.errors, []);
const tool = loaded.extensions[0].tools.get("web_search").definition;
const execute = (ctx, query = "test query", signal) => tool.execute("search-1", { query }, signal, undefined, ctx);

test("unsupported models, blank queries, and cancellation do not start a search", async () => {
  const ctx = { model: { provider: "claude-code", id: "test-claude" }, modelRegistry: { getProviderAuth: () => assert.fail("must not start a search") } };
  await assert.rejects(execute({ ...ctx, model: { provider: "other" } }), /requires a claude-code model/);
  await assert.rejects(execute(ctx, "  "), /must not be blank/);
  await assert.rejects(execute(ctx, "query", AbortSignal.abort()), { name: "AbortError" });
});

async function claude(t, mode = "success") {
  const root = await mkdtemp(join(tmpdir(), "pi-search-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const command = join(root, "claude.cjs");
  const capture = join(root, "capture.json");
  await writeFile(command, `#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
if (args[0] === "auth") {
  console.log(JSON.stringify({ loggedIn: true, authMethod: "claude.ai", subscriptionType: "max" }));
} else {
  fs.writeFileSync(process.env.SEARCH_TEST_CAPTURE, JSON.stringify({ args, env: {
    config: process.env.CLAUDE_CONFIG_DIR, apiKey: process.env.ANTHROPIC_API_KEY,
    extraBody: process.env.CLAUDE_CODE_EXTRA_BODY, updater: process.env.DISABLE_AUTOUPDATER,
  } }));
  const mode = process.env.SEARCH_TEST_MODE;
  if (mode === "exit") process.exit(2);
  if (mode === "hang") { setInterval(() => {}, 1000); return; }
  const events = [
    { type: "assistant", message: { content: [{ type: "tool_use", name: "WebSearch", id: "s1" }] } },
    { type: "user", message: { content: [{ type: "tool_result", tool_use_id: "s1", is_error: mode === "tool-error" }] } },
    { type: "result", subtype: "success", result: mode === "big" ? "result\\n".repeat(3000) : "Answer: https://example.org/", usage: { input_tokens: 4, output_tokens: 5, cache_read_input_tokens: 6 }, total_cost_usd: 0.01,
      permission_denials: mode === "denied" ? [{ tool_name: "WebSearch" }] : [] },
  ];
  console.log((mode === "no-search" ? events.slice(-1) : events).map(e => JSON.stringify(e)).join("\\n"));
}
`, { mode: 0o700 });
  const env = {
    PI_CLAUDE_CODE_COMMAND: command, PI_CLAUDE_CODE_CONFIG_DIR: join(root, "profile"),
    SEARCH_TEST_CAPTURE: capture, SEARCH_TEST_MODE: mode, ANTHROPIC_API_KEY: "must-not-be-used",
    CLAUDE_CODE_EXTRA_BODY: '{"tools":[]}',
  };
  for (const key of ["ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_BASE_URL", "ANTHROPIC_FOUNDRY_API_KEY", "CLAUDE_CODE_USE_BEDROCK", "CLAUDE_CODE_USE_VERTEX", "CLAUDE_CODE_USE_FOUNDRY"]) env[key] = "";
  return { ctx: { model: { provider: "claude-code", id: "test-claude" }, modelRegistry: { getProviderAuth: async () => ({ env }) } }, capture, env };
}

test("Claude delegates to the search-only CLI with the provider's login profile", async (t) => {
  const { ctx, capture } = await claude(t);
  const query = '-query "quotes"; $(touch /should-not-run)';
  const result = await execute(ctx, query);
  assert.equal(result.content[0].text, "Answer: https://example.org/");
  assert.equal(result.usage.totalTokens, 15);
  assert.equal(result.usage.cost.total, 0.01);
  const { args, env } = JSON.parse(await readFile(capture, "utf8"));
  for (const flag of ["--tools", "--allowedTools"]) assert.equal(args[args.indexOf(flag) + 1], "WebSearch");
  for (const flag of ["--safe-mode", "--strict-mcp-config", "--no-session-persistence"]) assert.ok(args.includes(flag));
  assert.equal(args[args.indexOf("--model") + 1], "test-claude");
  assert.equal(args[args.indexOf("--permission-mode") + 1], "dontAsk");
  assert.deepEqual(args.slice(-2), ["--", query]);
  assert.match(env.config, /profile$/);
  assert.equal(env.apiKey, undefined);
  assert.equal(env.extraBody, undefined);
  assert.equal(env.updater, "1");
});

test("Claude refuses missing/failed searches, denials, conflicting auth, and process failure", async (t) => {
  for (const mode of ["no-search", "tool-error", "denied", "exit"]) {
    const { ctx } = await claude(t, mode);
    await assert.rejects(execute(ctx));
  }
  const { ctx, env } = await claude(t);
  env.ANTHROPIC_AUTH_TOKEN = "must-not-be-used";
  await assert.rejects(execute(ctx), /refuses backend overrides: ANTHROPIC_AUTH_TOKEN/);
});

test("cancelling Claude terminates the subprocess", async (t) => {
  const { ctx, capture } = await claude(t, "hang");
  const controller = new AbortController();
  const pending = assert.rejects(execute(ctx, "query", controller.signal), { name: "AbortError" });
  for (let i = 0; i < 200; i++) {
    if (await readFile(capture).then(() => true, () => false)) break;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  controller.abort();
  await pending;
});

test("oversized search results are bounded and preserved in a private temporary file", async (t) => {
  const text = "result\n".repeat(3000);
  const result = await execute((await claude(t, "big")).ctx);
  const full = result.details.fullOutputPath;
  try {
    assert.match(result.content[0].text, /Output truncated/);
    assert.ok(result.content[0].text.length < text.length);
    assert.ok((await readFile(full, "utf8")).startsWith(text));
  } finally {
    await rm(join(full, ".."), { recursive: true, force: true });
  }
});

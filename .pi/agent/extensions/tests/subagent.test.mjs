import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("../subagent/index.ts", import.meta.url), "utf8");
const start = source.indexOf("async function runSingleAgent(");
const end = source.indexOf("\nconst TaskItem", start);
let args;
const runSingleAgent = runInNewContext(
  stripTypeScriptTypes(source.slice(start, end)) + "\nrunSingleAgent;",
  {
    getPiInvocation: (argv) => ({ command: "pi", args: argv }),
    spawn: (_command, argv) => {
      args = argv;
      const proc = new EventEmitter();
      proc.stdout = new EventEmitter();
      proc.stderr = new EventEmitter();
      queueMicrotask(() => proc.emit("close", 0, null));
      return proc;
    },
  },
);

async function dispatch(model, provider) {
  const result = await runSingleAgent(
    { provider, model: `${provider}/session-model`, thinkingLevel: "medium" },
    { cwd: "/tmp", agent: { name: "builder", source: "user", model, systemPrompt: "" } },
    "builder", "task", undefined, undefined, undefined,
    (results) => ({ mode: "single", results }),
  );
  assert.equal(result.status, "completed");
  return args;
}

test("subagent selects the dispatching provider's model, including its thinking suffix", async () => {
  const models = { "openai-codex": "openai-codex/gpt:high", "claude-code": "claude-code/sonnet:high" };
  for (const provider of Object.keys(models)) {
    const argv = await dispatch(models, provider);
    assert.equal(argv[argv.indexOf("--model") + 1], models[provider]);
    assert.equal(argv.includes("--thinking"), false);
  }
});

test("subagent preserves scalar models and inherits session defaults for unlisted providers", async () => {
  const scalar = await dispatch("other/fixed:high", "openai-codex");
  assert.equal(scalar[scalar.indexOf("--model") + 1], "other/fixed:high");
  assert.equal(scalar.includes("--thinking"), false);
  for (const model of [undefined, { "claude-code": "claude-code/sonnet" }]) {
    const argv = await dispatch(model, "openai-codex");
    assert.equal(argv[argv.indexOf("--model") + 1], "openai-codex/session-model");
    assert.equal(argv[argv.indexOf("--thinking") + 1], "medium");
  }
});

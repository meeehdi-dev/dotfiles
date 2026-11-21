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

async function dispatch(model) {
  const result = await runSingleAgent(
    { model: "claude-code/session-model", thinkingLevel: "medium" },
    { cwd: "/tmp", agent: { name: "builder", source: "user", model, systemPrompt: "" } },
    "builder", "task", undefined, undefined, undefined,
    (results) => ({ mode: "single", results }),
  );
  assert.equal(result.status, "completed");
  return args;
}

test("subagent passes the agent's model, including its thinking suffix", async () => {
  const argv = await dispatch("claude-code/sonnet:high");
  assert.equal(argv[argv.indexOf("--model") + 1], "claude-code/sonnet:high");
  assert.equal(argv.includes("--thinking"), false);
});

test("subagent without a model inherits the session model and thinking level", async () => {
  const argv = await dispatch(undefined);
  assert.equal(argv[argv.indexOf("--model") + 1], "claude-code/session-model");
  assert.equal(argv[argv.indexOf("--thinking") + 1], "medium");
});

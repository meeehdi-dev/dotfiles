import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
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

const install = join(homedir(), ".pi/agent/install");
const piRoot = process.env.PI_TEST_PACKAGE_ROOT ?? join(install, "releases", readFileSync(join(install, "current-version"), "utf8").trim(), "node_modules/@earendil-works/pi-coding-agent");
const { loadExtensions, createExtensionRuntime } = await import(pathToFileURL(join(piRoot, "dist/core/extensions/loader.js")));
const { createEventBus } = await import(pathToFileURL(join(piRoot, "dist/core/event-bus.js")));

test("subagent discovery advertises fresh user metadata and routing only while the tool is active", async (t) => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "pi-subagent-")));
  const previous = process.env.PI_CODING_AGENT_DIR;
  process.env.PI_CODING_AGENT_DIR = dir;
  t.after(() => {
    rmSync(dir, { recursive: true, force: true });
    if (previous === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = previous;
  });
  mkdirSync(join(dir, "agents"));
  mkdirSync(join(dir, ".pi", "agents"), { recursive: true });
  const agent = join(dir, "agents", "helper.md");
  writeFileSync(agent, "---\nname: helper\ndescription: Focused implementation\n---\nPRIVATE USER BODY\n");
  writeFileSync(join(dir, ".pi", "agents", "local.md"), "---\nname: local\ndescription: PRIVATE PROJECT DESCRIPTION\n---\nPRIVATE PROJECT BODY\n");
  const loaded = await loadExtensions([new URL("../subagent/index.ts", import.meta.url).pathname], dir, createEventBus(), createExtensionRuntime());
  assert.deepEqual(loaded.errors, []);
  const [inject] = loaded.extensions[0].handlers.get("before_agent_start");
  const event = { systemPromptOptions: { selectedTools: ["subagent"], sections: { other: "preserve" } } };
  const ctx = { cwd: dir };
  await inject(event, ctx);
  const section = event.systemPromptOptions.sections.subagents;
  assert.match(section, /helper \(user\): Focused implementation/);
  assert.match(section, /planning → planner/);
  assert.match(section, /Never chain steps automatically unless asked/);
  assert.match(section, /Delegation grants no additional authority/);
  assert.doesNotMatch(section, /PRIVATE|\/work/);
  writeFileSync(agent, "---\nname: helper\ndescription: Updated specialty\n---\n");
  await inject(event, ctx);
  assert.match(event.systemPromptOptions.sections.subagents, /Updated specialty/);
  rmSync(agent);
  await inject(event, ctx);
  assert.match(event.systemPromptOptions.sections.subagents, /Available user agents for the subagent tool: none/);
  event.systemPromptOptions.selectedTools = ["read"];
  await inject(event, ctx);
  assert.equal(event.systemPromptOptions.sections.subagents, undefined);
  assert.equal(event.systemPromptOptions.sections.other, "preserve");
});

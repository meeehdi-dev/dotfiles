import assert from "node:assert/strict";
import { test } from "node:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Pi's own loader (jiti + aliases) resolves typebox/pi imports; no model, network or browser.
const install = join(homedir(), ".pi/agent/install");
const piRoot = process.env.PI_TEST_PACKAGE_ROOT ?? join(install, "releases", readFileSync(join(install, "current-version"), "utf8").trim(), "node_modules/@earendil-works/pi-coding-agent");
const { loadExtensions, createExtensionRuntime } = await import(pathToFileURL(join(piRoot, "dist/core/extensions/loader.js")));
const { createEventBus } = await import(pathToFileURL(join(piRoot, "dist/core/event-bus.js")));
const extensions = fileURLToPath(new URL("../../extensions/", import.meta.url));
const temp = (t) => { const dir = realpathSync(mkdtempSync(join(tmpdir(), "pi-workflow-"))); t.after(() => rmSync(dir, { recursive: true, force: true })); return dir; };

async function load(t) {
  const dir = temp(t);
  symlinkSync(join(extensions, "workflow-modes.ts"), join(dir, "workflow-modes.ts"));
  symlinkSync(join(extensions, "subagent"), join(dir, "subagent"));
  const runtime = createExtensionRuntime();
  const loaded = await loadExtensions([join(dir, "workflow-modes.ts"), join(dir, "subagent", "index.ts")], dir, createEventBus(), runtime);
  return { loaded, runtime };
}

// Runs /work with a stub context and returns the recorded phase entry.
async function work(t, cwd) {
  const { loaded, runtime } = await load(t);
  const entries = [], sent = [];
  Object.assign(runtime, { appendEntry: (type, data) => entries.push({ type: "custom", customType: type, data }),
    sendUserMessage: (text) => sent.push(text), getActiveTools: () => [], setActiveTools: () => {} });
  const ctx = { cwd, hasUI: true, sessionManager: { getBranch: () => entries },
    ui: { notify: () => {}, setStatus: () => {}, theme: { colors: { accent: { kind: "rgb", r: 9, g: 9, b: 9 } }, style: (s) => s } } };
  await loaded.extensions[0].commands.get("work").handler("do it", ctx);
  assert.equal(entries.length, 1);
  assert.match(sent[0], /Begin Plan/);
  return entries[0].data;
}

test("both extensions load through symlinks and register the workflow surface", async (t) => {
  const { loaded } = await load(t);
  assert.deepEqual(loaded.errors, []);
  const [workflow, subagent] = loaded.extensions;
  assert.deepEqual([...workflow.commands.keys()], ["work"]);
  assert.deepEqual([...workflow.tools.keys()].sort(), ["workflow_exit", "workflow_phase", "workflow_question"]);
  assert.ok(subagent.tools.has("subagent"));
});

test("/work in Git records start commit and pre-existing changes, creating nothing", async (t) => {
  const repo = join(temp(t), "repo");
  mkdirSync(join(repo, "sub"), { recursive: true });
  const git = (...args) => execFileSync("git", ["-C", repo, ...args], { encoding: "utf8", env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" } });
  git("init", "-q");
  writeFileSync(join(repo, "a"), "1\n");
  git("add", "a"); git("-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", "commit", "-qm", "i");
  writeFileSync(join(repo, "a"), "2\n");
  writeFileSync(join(repo, "sub", "new"), "x\n");
  const before = git("status", "--porcelain=v1", "--untracked-files=all");
  const { mode, input, task } = await work(t, join(repo, "sub"));
  assert.equal(mode, "plan");
  assert.equal(input, "do it");
  assert.equal(task.kind, "git");
  assert.equal(task.root, repo);
  assert.equal(task.commit, git("rev-parse", "HEAD").trim());
  assert.deepEqual(task.pending.sort(), ["a", "sub/new"]);
  assert.match(task.projectKey, /^repo-[0-9a-f]{12}$/);
  assert.equal(git("status", "--porcelain=v1", "--untracked-files=all"), before);
  assert.equal(git("worktree", "list").trim().split("\n").length, 1);
});

test("/work in a non-Git folder is in place with a path-based key", async (t) => {
  const dir = join(temp(t), "plain folder");
  mkdirSync(dir);
  const { task } = await work(t, dir);
  assert.equal(task.kind, "directory");
  assert.equal(task.root, dir);
  assert.match(task.projectKey, /^plain-folder-[0-9a-f]{12}$/);
  assert.deepEqual(readdirSync(dir), []);
});

test("workflow sections omit skill bodies and stay stable across unchanged runs", async (t) => {
  const { loaded, runtime } = await load(t);
  Object.assign(runtime, { getActiveTools: () => [], setActiveTools: () => {},
    appendEntry: () => assert.fail("Prompt injection must not append entries"),
    sendUserMessage: () => assert.fail("Prompt injection must not send messages") });
  let mode;
  const ctx = { sessionManager: { getBranch: () => [{ type: "custom", customType: "workflow-phase",
    data: { mode, input: "task", task: { id: "id", root: "/task", kind: "directory", projectKey: "key" } } }] },
    ui: { setStatus: () => {}, theme: { style: (s) => s, colors: Object.fromEntries(
      ["accent", "warning", "muted", "success"].map((name) => [name, { kind: "rgb", r: 9, g: 9, b: 9 }])) } } };
  const skillPath = join(temp(t), "unread-skill.md");
  const event = () => ({ systemPromptOptions: { sections: {},
    skills: [{ name: "plannotator", filePath: skillPath }] } });
  const [inject] = loaded.extensions[0].handlers.get("before_agent_start");
  for (mode of ["plan", "build", "review", "ui", "finalize"]) {
    const first = event(), second = event();
    assert.equal(await inject(first, ctx), undefined);
    assert.equal(await inject(second, ctx), undefined);
    const section = first.systemPromptOptions.sections.workflow;
    assert.match(section, /# Workflow rules/);
    assert.ok(section.includes(`Phase: ${mode}`));
    assert.doesNotMatch(section, /<skill|unread-skill/);
    assert.equal(second.systemPromptOptions.sections.workflow, section);
  }
});

test("nested usage counts finalized calls once and retains live and failed usage", async (t) => {
  const { loaded } = await load(t);
  const { renderResult } = loaded.extensions[1].tools.get("subagent").definition;
  const theme = { fg: (_c, s) => s, bold: (s) => s };
  const agent = (n, extra = {}) => ({ agent: "agent", agentSource: "user", task: "task", exitCode: 0,
    stderr: "", messages: [], usage: { input: n, output: n * 2, cacheRead: n * 3, cacheWrite: n * 4,
      cost: n / 1000, turns: n, contextTokens: 77777 }, ...extra });
  const details = (...results) => ({ mode: "single", results });
  const finished = (id, ...results) => ({ role: "toolResult", toolCallId: id, toolName: "subagent",
    content: [], details: details(...results) });
  const grandchild = agent(3, { exitCode: 1, stopReason: "error" });
  const child = agent(2, { messages: [finished("grandchild", grandchild)] });
  const parent = agent(1, { messages: [finished("child", child), finished("child", child)],
    nested: { child: details(agent(80)), live: details(agent(4, { exitCode: -1 })) } });
  for (const mode of ["single", "chain", "parallel"]) {
    for (const expanded of [false, true]) {
      const result = { content: [], details: { mode, results: [parent] } };
      const text = renderResult(result, { expanded }, theme, {}).render(250).join("\n");
      assert.match(text, /Total \(incl\. nested\): 10 turns ↑10 ↓20 R30 W40 \$0\.0100/);
      assert.doesNotMatch(text, /Total[^\n]*ctx:/);
      if (mode === "single" || expanded) assert.match(text, /Own: 1 turn ↑1 ↓2 R3 W4 \$0\.0010 ctx:78k/);
    }
  }
  const running = { content: [], details: { mode: "parallel", results: [{ ...parent, exitCode: -1 }] } };
  assert.match(renderResult(running, { expanded: false }, theme, {}).render(250).join("\n"),
    /Total \(incl\. nested\): 10 turns ↑10 ↓20 R30 W40 \$0\.0100/);
});

test("nested subagent activity renders under the orchestrator's call", async (t) => {
  const { loaded } = await load(t);
  const { renderResult } = loaded.extensions[1].tools.get("subagent").definition;
  const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, contextTokens: 0, turns: 1 };
  const builder = { agent: "builder", agentSource: "user", task: "F2", exitCode: 0, stderr: "", usage,
    messages: [{ role: "assistant", content: [{ type: "toolCall", id: "b1", name: "bash", arguments: { command: "npm test" } }] }] };
  const call = { role: "assistant", content: [{ type: "toolCall", id: "o1", name: "subagent", arguments: { agent: "builder", task: "F2" } }] };
  const orchestrator = (messages, nested) => ({ content: [], details: { mode: "single", agentScope: "user", projectAgentsDir: null,
    results: [{ agent: "orchestrator", agentSource: "user", task: "loop", exitCode: 0, stderr: "", usage, messages, nested }] } });
  const theme = { fg: (_c, s) => s, bold: (s) => s };
  const render = (result, expanded) => renderResult(result, { expanded }, theme, {}).render(200).join("\n");

  const live = render(orchestrator([call], { o1: { mode: "single", results: [builder] } }), false);
  assert.match(live, /→ subagent[\s\S]*⏳ builder[\s\S]*\$ npm test/);
  assert.match(render(orchestrator([call], { o1: { mode: "single", results: [builder] } }), true), /Task: F2/);
  // The finished tool result replaces the live partial.
  const done = { mode: "single", results: [{ ...builder, stopReason: "stop" }] };
  const finished = render(orchestrator([call, { role: "toolResult", toolCallId: "o1", toolName: "subagent", content: [], details: done, isError: false }], { o1: { mode: "single", results: [builder] } }), false);
  assert.match(finished, /✓ builder/);
  assert.doesNotMatch(finished, /⏳ builder/);
});

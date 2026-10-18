import assert from "node:assert/strict";
import { after, test } from "node:test";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const workflow = fileURLToPath(new URL("..", import.meta.url));
const extensionPath = resolve(workflow, "../extensions/workflow-modes.ts");
const temp = mkdtempSync(join(tmpdir(), "pi-workflow-"));
const cwd = join(temp, "project"), agentDir = join(temp, "agent");
mkdirSync(cwd); mkdirSync(join(agentDir, "workflow"), { recursive: true });
const modes = ["plan", "build", "review", "ui", "finalize"];
for (const mode of modes) cpSync(join(workflow, `${mode}.md`), join(agentDir, "workflow", `${mode}.md`));
const previousAgent = process.env.PI_CODING_AGENT_DIR;
process.env.PI_CODING_AGENT_DIR = agentDir;
after(() => {
  if (previousAgent === undefined) delete process.env.PI_CODING_AGENT_DIR;
  else process.env.PI_CODING_AGENT_DIR = previousAgent;
  rmSync(temp, { recursive: true, force: true });
});
const install = join(homedir(), ".pi/agent/install");
const piRoot = process.env.PI_TEST_PACKAGE_ROOT ?? join(install, "releases", readFileSync(join(install, "current-version"), "utf8").trim(), "node_modules/@earendil-works/pi-coding-agent");
const { loadExtensions, createExtensionRuntime } = await import(pathToFileURL(join(piRoot, "dist/core/extensions/loader.js")));
const { createEventBus } = await import(pathToFileURL(join(piRoot, "dist/core/event-bus.js")));
const { validateToolArguments } = await import(pathToFileURL(resolve(piRoot, "../pi-ai/dist/utils/validation.js")));
const workflowTools = ["workflow_handoff", "workflow_question"];
const normalTools = ["read", "bash", "edit", "write", "web_search", "codemode", "tool_search", "mcp__research"];
const phaseEntry = (data) => ({ type: "custom", customType: "workflow-phase", data });
const rgb = (r, g, b) => ({ kind: "rgb", r, g, b });
const modeColors = { plan: "accent", build: "warning", review: "muted", ui: "accent", finalize: "success" };
const configuredThemeColors = {
  accent: rgb(167, 152, 215), warning: rgb(205, 154, 34), muted: rgb(157, 165, 169), success: rgb(104, 183, 141),
};
const darkBadgeColors = {
  accent: rgb(32, 32, 32), warning: rgb(48, 32, 16), muted: rgb(16, 16, 16), success: rgb(40, 48, 40),
};
const colorHex = (color) => typeof color === "string" ? color : `#${[color.r, color.g, color.b].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
const badgeStatus = (mode, foreground, colors = configuredThemeColors) => ({
  key: "workflow", text: `[${foreground}:${colorHex(colors[modeColors[mode]])}] ${mode} `,
});

async function harness({ entries = [], skills = ["ponytail", "ponytail-review"], tools = normalTools, failure, select = () => undefined, mode = "tui", themeColors = configuredThemeColors } = {}) {
  const sessions = [], pending = new Set(), errors = [];
  let current;
  async function event(session, name, fields = {}) {
    const data = { type: name, ...fields };
    for (const handler of session.extension.handlers.get(name) ?? []) await handler(data, session.ctx);
    return data;
  }
  function queue(promise) {
    pending.add(promise);
    promise.then(() => pending.delete(promise), (error) => { errors.push(error); pending.delete(promise); });
  }
  async function dispatch(session, content, options) {
    if (session !== current) throw new Error("Stale session context");
    session.sent.push({ content, options });
    if (options?.expandPromptTemplates && content.startsWith("/")) {
      const split = content.indexOf(" ");
      const name = content.slice(1, split < 0 ? undefined : split);
      const handler = session.extension.commands.get(name)?.handler;
      if (handler) return handler(split < 0 ? "" : content.slice(split + 1), session.ctx);
    }
    const before = await event(session, "before_agent_start", { messageType: "user", prompt: content, systemPromptOptions: { sections: { existing: "untouched" } } });
    session.prompts.push(before.systemPromptOptions.sections);
    session.records.push({ type: "message", message: { role: "user", content } });
  }
  async function makeSession(records) {
    const runtime = createExtensionRuntime(), bus = createEventBus();
    const loaded = await loadExtensions([extensionPath], cwd, bus, runtime);
    assert.deepEqual(loaded.errors, [], "the installed Pi loader must accept the extension");
    const session = { runtime, bus, extension: loaded.extensions[0], records: structuredClone(records), active: [...tools], sent: [], prompts: [], notices: [], notifications: [], statuses: [], selections: [], busy: 0, idle: [] };
    session.ctx = {
      cwd, hasUI: mode === "tui" || mode === "rpc", mode, signal: undefined,
      sessionManager: { getBranch: () => session.records, getSessionId: () => String(sessions.indexOf(session)) },
      ui: {
        notify: (text, level) => session.notifications.push({ text, level }),
        setStatus: (key, text) => session.statuses.push({ key, text }),
        theme: { colors: themeColors, style: (text, { fg, bg }) => `[${colorHex(fg)}:${colorHex(bg)}]${text}` },
        confirm: () => assert.fail("No workflow permission dialog"),
        select: async (title, options, opts) => {
          assert.ok(session.ctx.hasUI, "never open a dialog without UI");
          session.selections.push({ title, options, signal: opts?.signal });
          return select(title, options, opts);
        },
      },
      waitForIdle: async () => { if (session.busy) await new Promise((done) => session.idle.push(done)); },
      newSession: async (options) => {
        assert.equal(session, current, "use the live command context");
        assert.equal(session.busy, 0, "a tool must return before switching sessions");
        if (failure === "create") throw new Error("new session unavailable");
        if (failure === "cancel") return { cancelled: true };
        session.runtime.invalidate(); session.bus.clear();
        const next = await makeSession([]);
        await options.setup?.({ appendCustomEntry: (customType, data) => next.records.push({ type: "custom", customType, data: structuredClone(data) }) });
        await options.withSession?.({ ...next.ctx,
          sendUserMessage: async (content, options) => {
            if (failure === "prompt") throw new Error("prompt delivery unavailable");
            await dispatch(next, content, options);
          },
          sendMessage: async (message) => next.notices.push(message),
        });
        return { cancelled: false };
      },
    };
    Object.assign(runtime, {
      getActiveTools: () => [...session.active],
      setActiveTools: (names) => { session.active = [...names]; },
      getCommands: () => skills.map((name) => ({ name: `skill:${name}`, source: "skill" })),
      sendMessage: (message) => session.notices.push(message),
      sendUserMessage: (content, options) => {
        if (failure === "queue") throw new Error("dispatch unavailable");
        if (failure !== "drop") queue(dispatch(session, content, options));
      },
      setModel: () => assert.fail("Pi owns models"),
      setThinkingLevel: () => assert.fail("Pi owns thinking"),
    });
    sessions.push(session); current = session;
    await event(session, "session_start");
    return session;
  }
  await makeSession(entries);
  async function flush() {
    while (pending.size) await Promise.allSettled([...pending]);
    assert.deepEqual(errors, []);
  }
  return {
    sessions, get current() { return current; },
    command: async (name, input = "") => { await current.extension.commands.get(name).handler(input, current.ctx); await flush(); },
    async call(input, signal, tool = "workflow_handoff") {
      const session = current;
      session.busy++;
      let result;
      try { result = await session.extension.tools.get(tool).definition.execute("call", input, signal, undefined, session.ctx); }
      finally { session.busy--; for (const done of session.idle.splice(0)) done(); }
      await flush();
      return result;
    },
    task: async (content = "Continue") => { await dispatch(current, content); return current.prompts.at(-1); },
    tree: async (records) => { current.records = structuredClone(records); await event(current, "session_tree"); },
    resume: async (records) => { current.runtime.invalidate(); current.bus.clear(); await makeSession(records); },
    setFailure(value) { failure = value; },
    close() { for (const session of sessions) { session.runtime.invalidate(); session.bus.clear(); } },
  };
}

function state(h) { return h.current.records.find((entry) => entry.customType === "workflow-phase")?.data; }

test("idle Pi shows auto without a workflow prompt, helper, permission hooks, or model changes", async (t) => {
  const h = await harness(); t.after(() => h.close());
  assert.deepEqual(h.current.active, normalTools);
  assert.deepEqual(await h.task("An ordinary task"), { existing: "untouched" });
  assert.deepEqual(h.current.statuses.at(-1), { key: "workflow", text: "[text:selectedBg] auto " });
  assert.deepEqual(h.current.notifications, []);
  assert.deepEqual([...h.current.extension.tools.keys()], workflowTools);
  for (const name of workflowTools) assert.equal(h.current.extension.tools.get(name).definition.defaultActive, false);
  assert.ok(!h.current.extension.handlers.has("tool_call"));
  await h.command("workflow");
  assert.match(h.current.notices.at(-1).content, /Phase: not selected/);
  assert.equal(h.sessions.length, 1);
});

test("every phase command immediately starts a fresh extension runtime, and may be repeated or skipped", async (t) => {
  const h = await harness(); t.after(() => h.close());
  for (const mode of ["finalize", "plan", "build", "review", "review", "ui", "plan"]) {
    const previous = h.current;
    await h.command(mode, "a reference or task");
    assert.notEqual(h.current.extension, previous.extension);
    assert.deepEqual(state(h), { mode, input: "a reference or task" });
    assert.deepEqual(h.current.statuses.at(-1), badgeStatus(mode, "#000000"));
    assert.match(h.current.prompts[0].workflow, new RegExp(`Phase: ${mode}`));
    assert.equal(h.current.prompts[0].existing, "untouched");
    assert.deepEqual(h.current.active, [...normalTools, ...workflowTools]);
    assert.equal(h.current.records.filter((entry) => entry.type === "message").length, 1);
  }
});

test("dark-valued mode colors use white foregrounds for contrast", async (t) => {
  const h = await harness({ themeColors: darkBadgeColors }); t.after(() => h.close());
  for (const mode of modes) {
    await h.command(mode, "plan.md");
    assert.deepEqual(h.current.statuses.at(-1), badgeStatus(mode, "#ffffff", darkBadgeColors));
  }
});

test("selected badge adopts a changed theme on the next sync, not while idle", async (t) => {
  const h = await harness(); t.after(() => h.close());
  await h.command("build", "plan.md");
  const oldStatus = h.current.statuses.at(-1), statusCount = h.current.statuses.length;
  const nextColors = { ...configuredThemeColors, warning: rgb(32, 32, 32) };
  Object.assign(h.current.ctx.ui.theme.colors, nextColors);
  assert.equal(h.current.statuses.length, statusCount);
  assert.deepEqual(h.current.statuses.at(-1), oldStatus);

  await h.task();
  assert.deepEqual(h.current.statuses.at(-1), badgeStatus("build", "#ffffff", nextColors));
});

test("missing input is clarified in a usable fresh phase, not refused", async (t) => {
  const h = await harness(); t.after(() => h.close());
  for (const mode of modes) {
    await h.command(mode);
    assert.equal(state(h).mode, mode);
    assert.match(h.current.sent[0].content, /Ask the user for the task or plan\/reference/);
    assert.ok(h.current.active.includes("workflow_handoff"));
  }
});

test("tasks/references are intact text, not parsed by suffix, filesystem existence, quoting, or shell syntax", async (t) => {
  const h = await harness(); t.after(() => h.close());
  for (const input of ["Investigate missing/report.md", '  Fix O\'Brien\'s "parser"\nwith \\backslashes  ', '"quoted prose"', "../missing directory", "~/plan with spaces.md", "$(touch NEVER-RUN); nonexistent.md"]) {
    await h.command("plan", input);
    assert.equal(state(h).input, input);
    assert.ok(h.current.sent[0].content.includes(input));
  }
  assert.equal(existsSync(join(cwd, "NEVER-RUN")), false);
});

test("handoffs wait for their tool to return, carry only reference/notes, and use the fresh context", async (t) => {
  const h = await harness(); t.after(() => h.close());
  await h.command("build", "origin-plan.md");
  await h.task("PRIVATE old transcript must not cross the handoff");
  for (const mode of modes) {
    const input = join(cwd, `task's \"quote\" \\path.md`), notes = "Keep existing errors.\nHuman guidance only.";
    const previous = h.current;
    const result = await h.call({ mode, input, notes });
    assert.equal(result.terminate, true);
    assert.match(result.content[0].text, new RegExp(`/${mode} `));
    assert.notEqual(h.current, previous);
    assert.deepEqual(state(h), { mode, input, notes });
    assert.ok(h.current.sent[0].content.includes(notes));
    assert.ok(!h.current.sent[0].content.includes("PRIVATE old transcript"));
    assert.equal(h.current.records.filter((entry) => entry.type === "message").length, 1);
  }
});

const decision = { question: "Review is complete. UI review or skip to Finalize?", options: ["UI", "Finalize"] };

for (const mode of ["tui", "rpc"]) test(`${mode} native choice returns the exact label without routing, then handoff dispatches once`, async (t) => {
  const h = await harness({ mode, select: () => "Finalize" }); t.after(() => h.close());
  await h.command("review", "original-plan.md");
  const before = h.sessions.length, controller = new AbortController();
  const definition = h.current.extension.tools.get("workflow_question").definition;
  assert.equal(definition.exposure, "model-only");
  assert.equal(definition.executionMode, "sequential");
  assert.deepEqual(validateToolArguments(definition, { name: definition.name, arguments: decision }), decision);
  const result = await h.call(decision, controller.signal, "workflow_question");
  assert.deepEqual(h.current.selections, [{ title: decision.question, options: decision.options, signal: controller.signal }]);
  assert.deepEqual(result.details, { status: "selected", choice: "Finalize" });
  assert.equal(result.content[0].text, "Selected: Finalize");
  assert.equal(result.terminate, undefined);
  assert.equal(h.sessions.length, before);
  assert.equal(h.current.sent.length, 1, "question queues no message");
  const prompt = (await h.task()).workflow;
  assert.match(prompt, /Use workflow_question for finite workflow decisions/);
  assert.match(prompt, /Do not add a question gate to already-authorized transitions/);
  assert.match(prompt, /without UI, ask the returned question\/options in chat/);
  await h.call({ mode: "finalize", input: "original-plan.md", notes: "Human chose to skip UI" });
  assert.equal(h.sessions.length, before + 1);
  assert.deepEqual(state(h), { mode: "finalize", input: "original-plan.md", notes: "Human chose to skip UI" });
});

test("Escape terminates automatic continuation without dispatch, and chat remains usable", async (t) => {
  const h = await harness(); t.after(() => h.close());
  await h.command("review", "plan.md");
  const before = h.sessions.length, sent = h.current.sent.length;
  const result = await h.call(decision, undefined, "workflow_question");
  assert.equal(result.details.status, "cancelled");
  assert.equal(result.terminate, true);
  assert.match(result.content[0].text, /Wait for chat; do not reopen/);
  assert.equal(h.sessions.length, before);
  assert.equal(h.current.sent.length, sent);
  await h.task("Let's discuss instead");
  assert.equal(h.current.selections.length, 1);
  assert.equal(state(h).mode, "review");
});

for (const mode of ["print", "json"]) test(`${mode} returns unanswered question/options for chat without a dialog`, async (t) => {
  const h = await harness({ mode }); t.after(() => h.close());
  await h.command("review", "plan.md");
  const before = h.sessions.length;
  const result = await h.call(decision, undefined, "workflow_question");
  assert.deepEqual(result.details, { status: "unavailable", ...decision });
  assert.match(result.content[0].text, /Ask in chat; no action is authorized/);
  for (const text of [decision.question, ...decision.options]) assert.ok(result.content[0].text.includes(text));
  assert.equal(result.terminate, undefined, "allow the chat fallback follow-up");
  assert.equal(h.current.selections.length, 0);
  assert.equal(h.sessions.length, before);
});

test("invalid question arguments fail schema and runtime validation before showing UI", async (t) => {
  const h = await harness(); t.after(() => h.close());
  const definition = h.current.extension.tools.get("workflow_question").definition;
  for (const input of [
    { ...decision, question: "" }, { ...decision, question: " \n\t" },
    { ...decision, options: [] }, { ...decision, options: ["Only"] },
    { ...decision, options: ["", "Valid"] }, { ...decision, options: [" \t", "Valid"] },
    { ...decision, options: ["Same", "Same"] }, {},
  ]) {
    assert.throws(() => validateToolArguments(definition, { name: definition.name, arguments: input }), /Validation failed/);
    await assert.rejects(() => h.call(input, undefined, "workflow_question"), /nonblank/);
  }
  assert.equal(h.current.selections.length, 0);
  assert.equal(h.sessions.length, 1);
});

test("unexpected dialog values never authorize a choice or route", async (t) => {
  for (const value of ["Other", "", null, 0]) {
    const h = await harness({ select: () => value }); t.after(() => h.close());
    await assert.rejects(() => h.call(decision, undefined, "workflow_question"), /Unexpected workflow choice; no action is authorized/);
    assert.equal(h.sessions.length, 1);
    assert.equal(h.current.sent.length, 0);
  }
});

test("abort before opening and during selection cannot return an authorization", async (t) => {
  const h = await harness(); t.after(() => h.close());
  await assert.rejects(() => h.call(decision, AbortSignal.abort(), "workflow_question"), /cancelled/);
  h.current.ctx.signal = AbortSignal.abort();
  await assert.rejects(() => h.call(decision, new AbortController().signal, "workflow_question"), /cancelled/);
  assert.equal(h.current.selections.length, 0);
  for (const source of ["tool", "context"]) {
    let resolveDialog, opened;
    const ready = new Promise((resolve) => { opened = resolve; });
    const controller = new AbortController(), other = new AbortController();
    const deferred = await harness({ select: (_title, _options, { signal }) => {
      opened(signal);
      return new Promise((resolve) => { resolveDialog = resolve; });
    } });
    t.after(() => deferred.close());
    deferred.current.ctx.signal = source === "context" ? controller.signal : other.signal;
    const pending = deferred.call(decision, source === "tool" ? controller.signal : other.signal, "workflow_question");
    const rejection = assert.rejects(pending, /cancelled/);
    const dialogSignal = await ready;
    controller.abort();
    assert.equal(dialogSignal.aborted, true, "native dialog receives the execution abort");
    resolveDialog("Finalize"); // Even a stale selected result after abort is not authorization.
    await rejection;
    assert.equal(deferred.sessions.length, 1);
    assert.equal(deferred.current.sent.length, 0);
  }
});

test("Build and Review request only their targeted skills; missing skills warn and continue", async (t) => {
  const h = await harness(); t.after(() => h.close());
  for (const [mode, skill] of [["build", "ponytail"], ["review", "ponytail-review"]]) {
    await h.command(mode, "plan.md");
    assert.ok(h.current.sent[0].content.startsWith(`/skill:${skill} `));
    assert.equal(h.current.sent[0].options.expandPromptTemplates, true);
  }
  const missing = await harness({ skills: [] }); t.after(() => missing.close());
  await missing.command("review", "plan.md");
  assert.ok(missing.sessions[0].notifications.some(({ text }) => text.includes("unavailable")));
  assert.ok(missing.current.sent[0].content.startsWith("Begin review"));
});

test("resume restores phase/input without queuing work; tree navigation follows only its active branch", async (t) => {
  const h = await harness(); t.after(() => h.close());
  await h.command("ui", "plan.md");
  const records = structuredClone(h.current.records);
  await h.resume(records);
  assert.deepEqual(state(h), { mode: "ui", input: "plan.md" });
  assert.deepEqual(h.current.statuses.at(-1), badgeStatus("ui", "#000000"));
  assert.equal(h.current.sent.length, 0);
  assert.deepEqual(h.current.active, [...normalTools, ...workflowTools]);
  await h.tree([]);
  assert.deepEqual(h.current.active, normalTools);
  assert.deepEqual(h.current.statuses.at(-1), { key: "workflow", text: "[text:selectedBg] auto " });
  assert.deepEqual(await h.task(), { existing: "untouched" });
  await h.tree([phaseEntry({ mode: "plan", input: "another branch" })]);
  assert.deepEqual(h.current.statuses.at(-1), badgeStatus("plan", "#000000"));
  assert.match((await h.task()).workflow, /Input: another branch/);
});

test("legacy locks, pending approvals, and complete flags cannot restrict the new workflow", async (t) => {
  const h = await harness({ entries: [{ type: "custom", customType: "workflow-state", data: { mode: "review", complete: true, humanReview: "pending", pendingReviewId: "old" } }] });
  t.after(() => h.close());
  assert.deepEqual(await h.task(), { existing: "untouched" });
  await h.command("build", "user selected plan.md");
  assert.equal(state(h).mode, "build");
  await h.command("finalize", "a directory or reference");
  assert.equal(state(h).mode, "finalize");
});

test("ordinary tool exclusions and newly activated tools are preserved, without per-turn reactivation", async (t) => {
  const h = await harness({ tools: ["read", "web_search"] }); t.after(() => h.close());
  await h.command("review", "plan.md");
  assert.deepEqual(h.current.active, ["read", "web_search", ...workflowTools]);
  h.current.active = ["read", "web_search", "mcp__late", "workflow_external_search"];
  await h.task();
  assert.deepEqual(h.current.active, ["read", "web_search", "mcp__late", "workflow_external_search"]);
  h.current.active.push("workflow_question");
  await h.task();
  assert.ok(!h.current.active.includes("workflow_handoff"), "manual exclusion is respected independently");
  await h.tree([]);
  assert.deepEqual(h.current.active, ["read", "web_search", "mcp__late", "workflow_external_search"]);
  await h.tree([phaseEntry({ mode: "review", input: "plan.md" })]);
  assert.deepEqual(h.current.active, ["read", "web_search", "mcp__late", "workflow_external_search", ...workflowTools]);
});

for (const failure of ["create", "cancel", "prompt"]) test(`handoff ${failure} failure shows the manual command/notes and permits another attempt`, async (t) => {
  const h = await harness(); t.after(() => h.close());
  await h.command("build", "plan.md");
  h.setFailure(failure);
  const notes = "Preserve this human guidance";
  const result = await h.call({ mode: "review", input: "plan with spaces.md", notes });
  assert.ok(result.content[0].text.includes("/review plan with spaces.md"));
  const notices = h.sessions.flatMap((session) => [...session.notifications.map(({ text }) => text), ...session.notices.map(({ content }) => content)]);
  assert.ok(notices.some((text) => text.includes("/review plan with spaces.md") && text.includes(notes)));
  assert.equal(h.sessions.length, failure === "prompt" ? 3 : 2);
  h.setFailure(undefined);
  await h.command("review", "plan.md");
  assert.equal(state(h).mode, "review");
  assert.match(h.current.sent[0].content, /Begin review/);
});

test("dispatch failure or a dropped command retains the manual route without a watcher", async (t) => {
  for (const failure of ["queue", "drop"]) {
    const h = await harness({ failure }); t.after(() => h.close());
    const result = await h.call({ mode: "build", input: "plan.md", notes: "Keep these notes" });
    assert.ok(result.content[0].text.includes("/build plan.md"));
    assert.ok(result.content[0].text.includes("Keep these notes"));
    assert.equal(result.isError, failure === "queue" ? true : undefined);
    assert.equal(h.sessions.length, 1);
  }
});

test("RPC/print phase commands and authorized handoffs need no extra dialog", async (t) => {
  for (const mode of ["rpc", "print"]) {
    const h = await harness({ mode }); t.after(() => h.close());
    await h.command("plan", "Plan this task");
    assert.equal(state(h).mode, "plan");
    await h.call({ mode: "finalize", input: "plan.md" });
    assert.equal(state(h).mode, "finalize");
  }
});

test("cancelled tool calls and malformed internal commands never start a session", async (t) => {
  const h = await harness(); t.after(() => h.close());
  await assert.rejects(() => h.call({ mode: "build", input: "plan.md" }, AbortSignal.abort()), /cancelled/);
  for (const input of ["", "{}", "null", '{"mode":"shell","input":"bad"}', '{"mode":"build","input":7}', '{"mode":"build","input":"ok","notes":7}']) await h.command("workflow-handoff", input);
  assert.equal(h.sessions.length, 1);
  assert.equal(h.current.sent.length, 0);
});

test("phase prompts are reread; missing prompt files warn and leave normal Pi usable", async (t) => {
  const h = await harness(); t.after(() => h.close());
  const path = join(agentDir, "workflow", "plan.md"), original = readFileSync(path, "utf8");
  t.after(() => writeFileSync(path, original));
  await h.command("plan", "task");
  writeFileSync(path, "# Edited role\nA new user instruction.");
  assert.match((await h.task()).workflow, /A new user instruction/);
  rmSync(path);
  assert.match((await h.task()).workflow, /Help the user with the plan phase/);
  assert.match(h.current.notifications.at(-1).text, /prompt unavailable/);
  assert.ok(h.current.active.includes("write"));
});

test("artifact defaults are grouped home guidance with per-type project overrides, not file writers", async (t) => {
  const h = await harness(); t.after(() => h.close());
  // Local directories/history must not become an implicit output override.
  for (const type of ["plans", "reviews"]) {
    mkdirSync(join(cwd, ".pi", type), { recursive: true });
    writeFileSync(join(cwd, ".pi", type, "historical.md"), "Existing artifact");
  }
  for (const mode of modes) {
    await h.command(mode, "task");
    const prompt = h.current.prompts[0].workflow;
    assert.ok(prompt.includes("~/.pi/plans/<project-key>/<task>.md"));
    assert.ok(prompt.includes("~/.pi/reviews/<project-key>/<task>-<UTC timestamp>.md"));
    assert.match(prompt, /user\/task paths or applicable project-owned workflow\/agent instructions take precedence per artifact type/);
    assert.match(prompt, /a path for one type does not redirect another/);
    assert.match(prompt, /project\/repository root directory name/);
    assert.match(prompt, /parent path to disambiguate same-named projects/);
    assert.match(prompt, /ask if identity remains unclear/);
    assert.match(prompt, /Existing directories or historical files alone are not overrides/);
    assert.match(prompt, /instruction-only defaults, not enforced locations/);
    assert.match(prompt, /Expand ~ before calling filesystem tools/);
    assert.doesNotMatch(prompt, /(?<!~\/)\.pi\/(?:plans|reviews)\//);
  }
  for (const [mode, path] of [["plan", "~/.pi/plans/<project-key>/<task>.md"], ["review", "~/.pi/reviews/<project-key>/<task>-<UTC timestamp>.md"]]) {
    const prompt = readFileSync(join(workflow, `${mode}.md`), "utf8");
    assert.ok(prompt.includes(path));
    assert.match(prompt, /explicit user\/task or applicable project-instructed location for that artifact type/);
    assert.match(prompt, /instruction-only, not enforced/);
  }
  assert.equal(existsSync(join(cwd, ".pi/plans/task.md")), false);
  assert.deepEqual([...h.current.extension.tools.keys()], workflowTools);
});

test("short prompts retain selected role policies, with no deleted helper references", () => {
  const read = (mode) => readFileSync(join(workflow, `${mode}.md`), "utf8");
  assert.match(read("plan"), /independently classify every issue/i);
  assert.match(read("plan"), /browser or chat approval/i);
  assert.match(read("build"), /relevant tests\/typechecks\/non-fixing lint automatically/);
  assert.match(read("review"), /staged, unstaged, and untracked\/new/);
  assert.match(read("review"), /workflow_question to ask whether to return to Plan to revalidate findings or proceed/);
  assert.match(read("review"), /workflow_question to ask UI .* or Finalize/);
  assert.match(read("review"), /original implementation-plan reference; a Plan route instead receives the findings\/feedback report/);
  assert.match(read("ui"), /workflow_question to ask whether to return to Plan to revalidate feedback or proceed to Finalize/);
  assert.match(read("ui"), /workflow_question to ask whether to retry live review, skip to Finalize, or change direction/);
  assert.match(read("ui"), /Explicit approval of the live UI/);
  assert.match(read("build"), /call workflow_handoff for Review with the same absolute plan path/);
  assert.match(read("ui"), /cannot force --app/);
  assert.match(read("ui"), /live and may change real data/);
  assert.match(read("finalize"), /If no journals are required, make no document writes/);
  assert.match(read("finalize"), /complete task from its start/);
  for (const mode of modes) assert.doesNotMatch(read(mode), /workflow_(?:save_artifact|submit_plan|git|check|ui_review|finish)/);
});

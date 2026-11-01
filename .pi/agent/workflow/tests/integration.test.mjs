import assert from "node:assert/strict";
import { after, test } from "node:test";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import crypto, { randomUUID } from "node:crypto";
import { syncBuiltinESMExports } from "node:module";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const workflow = fileURLToPath(new URL("..", import.meta.url));
const extensionPath = resolve(workflow, "../extensions/workflow-modes.ts");
const temp = mkdtempSync(join(tmpdir(), "pi-workflow-"));
const cwd = join(temp, "project"), agentDir = join(temp, "agent");
mkdirSync(cwd); mkdirSync(join(agentDir, "workflow"), { recursive: true });
const modes = ["plan", "build", "review", "ui", "finalize"];
const skillFixtures = ["plannotator", "ponytail", "ponytail-review"].map((name) => {
  const baseDir = join(agentDir, "skills", name), filePath = join(baseDir, "SKILL.md");
  mkdirSync(baseDir, { recursive: true });
  writeFileSync(filePath, `# ${name}\nFixture instructions for ${name}.\n`);
  return { name, baseDir, filePath };
});
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
const { SessionManager } = await import(pathToFileURL(join(piRoot, "dist/core/session-manager.js")));
const previousHome = process.env.HOME;
process.env.HOME = temp;
after(() => { if (previousHome === undefined) delete process.env.HOME; else process.env.HOME = previousHome; });
function git(directory, ...args) {
  return execFileSync("git", ["-C", directory, ...args], { encoding: "utf8", env: { ...process.env, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null" } }).trimEnd();
}
function repository(directory) {
  mkdirSync(directory, { recursive: true });
  git(directory, "init", "--initial-branch=main");
  git(directory, "config", "user.name", "Workflow Test");
  git(directory, "config", "user.email", "workflow@example.invalid");
  writeFileSync(join(directory, "tracked"), "committed\n");
  mkdirSync(join(directory, "sub dir"));
  writeFileSync(join(directory, "sub dir", "tracked"), "committed subdirectory\n");
  git(directory, "add", ".");
  git(directory, "-c", "commit.gpgsign=false", "commit", "-m", "fixture");
  return realpathSync(directory);
}
repository(cwd);
const id = randomUUID();
git(cwd, "checkout", "-b", `pi/${id}`);
const defaultTask = { id, projectKey: "project-0123456789ab", repository: realpathSync(join(cwd, ".git")), sourceRoot: realpathSync(cwd), originalCwd: realpathSync(cwd), root: realpathSync(cwd), branch: `pi/${id}`, commit: git(cwd, "rev-parse", "HEAD") };
writeFileSync(join(cwd, ".git", "workflow-task.json"), JSON.stringify(defaultTask));
const workflowTools = ["workflow_handoff", "workflow_exit", "workflow_question"];
const normalTools = ["read", "bash", "edit", "write", "web_search", "codemode", "tool_search", "mcp__research"];
const phaseEntry = (data) => ({ type: "custom", customType: "workflow-phase", data: { ...data, task: defaultTask } });
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

async function harness({ entries = [], skills = ["plannotator", "ponytail", "ponytail-review"], tools = normalTools, failure, select = () => undefined, mode = "tui", themeColors = configuredThemeColors, directory = cwd, persistent = true } = {}) {
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
    const before = await event(session, "before_agent_start", { messageType: "user", prompt: content, systemPromptOptions: { sections: { existing: "untouched" }, skills: skillFixtures.filter((skill) => skills.includes(skill.name)) } });
    session.prompts.push(before.systemPromptOptions.sections);
    session.records.push({ type: "message", message: { role: "user", content } });
  }
  async function makeSession(records, workingDirectory = directory) {
    const runtime = createExtensionRuntime(), bus = createEventBus();
    const loaded = await loadExtensions([extensionPath], workingDirectory, bus, runtime);
    assert.deepEqual(loaded.errors, [], "the installed Pi loader must accept the extension");
    const session = { runtime, bus, extension: loaded.extensions[0], records: structuredClone(records), active: [...tools], sent: [], prompts: [], notices: [], notifications: [], statuses: [], selections: [], busy: 0, idle: [] };
    session.ctx = {
      cwd: workingDirectory, hasUI: mode === "tui" || mode === "rpc", mode, signal: undefined,
      sessionManager: {
        getBranch: () => session.records, getSessionId: () => String(sessions.indexOf(session)),
        getSessionFile: () => persistent ? join(temp, "source.jsonl") : undefined,
        getSessionDir: () => join(agentDir, "custom-sessions"),
      },
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
      switchSession: async (file, options) => {
        assert.equal(session, current, "use the live command context");
        assert.equal(session.busy, 0);
        if (failure === "switch") throw new Error("switch session unavailable");
        if (failure === "cancel") return { cancelled: true };
        const manager = SessionManager.open(file);
        await event(session, "session_shutdown");
        session.runtime.invalidate(); session.bus.clear();
        const next = await makeSession(manager.getBranch(), failure === "wrong-cwd" ? workingDirectory : manager.getCwd());
        next.entryFile = file;
        const context = manager.buildSessionContext();
        if (context.model) next.ctx.model = { provider: context.model.provider, id: context.model.modelId };
        next.ctx.thinkingLevel = context.thinkingLevel;
        await options.withSession?.({ ...next.ctx,
          sendUserMessage: async (content, options) => {
            if (failure === "prompt") throw new Error("prompt delivery unavailable");
            await dispatch(next, content, options);
          },
          sendMessage: async (message) => next.notices.push(message),
        });
        return { cancelled: false };
      },
      newSession: async (options) => {
        assert.equal(session, current, "use the live command context");
        assert.equal(session.busy, 0, "a tool must return before switching sessions");
        if (failure === "create") throw new Error("new session unavailable");
        if (failure === "cancel") return { cancelled: true };
        await event(session, "session_shutdown");
        session.runtime.invalidate(); session.bus.clear();
        const next = await makeSession([], workingDirectory);
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
    shutdown: async () => event(current, "session_shutdown"),
    resume: async (records) => { const workingDirectory = current.ctx.cwd; await event(current, "session_shutdown"); current.runtime.invalidate(); current.bus.clear(); await makeSession(records, workingDirectory); },
    setFailure(value) { failure = value; },
    async close() { for (const session of sessions) { await event(session, "session_shutdown"); session.runtime.invalidate(); session.bus.clear(); } },
  };
}

function taskState(h) { return h.current.records.find((entry) => entry.customType === "workflow-phase")?.data?.task; }
function state(h) { const data = h.current.records.find((entry) => entry.customType === "workflow-phase")?.data; if (!data) return; const { task, ...state } = data; return state; }

test("idle Pi shows auto without a workflow prompt, helper, permission hooks, or model changes", async (t) => {
  const h = await harness(); t.after(() => h.close());
  assert.deepEqual(h.current.active, normalTools);
  assert.deepEqual(await h.task("An ordinary task"), { existing: "untouched" });
  assert.deepEqual(h.current.statuses.at(-1), { key: "workflow", text: "[text:selectedBg] auto " });
  assert.deepEqual(h.current.notifications, []);
  assert.deepEqual([...h.current.extension.tools.keys()], [...workflowTools, "workflow_ui_server"]);
  for (const name of [...workflowTools, "workflow_ui_server"]) assert.equal(h.current.extension.tools.get(name).definition.defaultActive, false);
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
    assert.deepEqual(h.current.active, [...normalTools, ...workflowTools, ...(mode === "ui" ? ["workflow_ui_server"] : [])]);
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

test("feature progress notes survive fresh handoff and restore without automatic dispatch or artifact writes", async (t) => {
  const h = await harness(); t.after(() => h.close());
  const input = join(cwd, "feature-loop-plan.md");
  const reports = [join(cwd, "feature-1-review.md"), join(cwd, "clarifications.md")];
  const notes = `Authorized implementation loop; Feature 1; next: independent Review. Latest progress: ${reports[0]}; clarification: ${reports[1]}. Feature 1 implemented, not reviewed; Features 2/3 pending. Checks: focused suite passed.`;
  await h.command("build", input);
  await h.task("PRIVATE implementation transcript");
  const before = h.current;
  await h.call({ mode: "review", input, notes });
  assert.notEqual(h.current.extension, before.extension);
  assert.deepEqual(state(h), { mode: "review", input, notes });
  assert.ok(h.current.prompts[0].workflow.includes(notes));
  assert.ok(!h.current.sent[0].content.includes("PRIVATE implementation transcript"));
  const records = structuredClone(h.current.records);
  await h.resume(records);
  assert.deepEqual(state(h), { mode: "review", input, notes });
  assert.equal(h.current.sent.length, 0);
  assert.equal(h.current.prompts.length, 0);
  const restored = (await h.task()).workflow;
  assert.ok(restored.includes(notes));
  assert.match(restored, /Restoring a session never automatically dispatches work/);
  assert.match(restored, /reconcile missing, stale, or conflicting progress from code, checks, and referenced reports/);
  for (const path of [input, ...reports]) assert.equal(existsSync(path), false, "transport must not create or rewrite artifacts");
  assert.deepEqual(Object.keys(h.current.extension.tools.get("workflow_handoff").definition.parameters.properties).sort(), ["input", "mode", "notes"]);
});

// These scripted transitions verify transport and injected contracts, not model scheduling decisions.
test("feature Build → Review → fix → Review → next Build keeps original plan and cumulative references", async (t) => {
  const h = await harness(); t.after(() => h.close());
  const input = join(cwd, "loop-plan.md");
  const clarification = join(cwd, "clarification.md");
  const first = join(cwd, "feature-1-findings.md"), second = join(cwd, "feature-1-clean.md");
  await h.command("build", input);
  const steps = [
    ["review", `Feature 1 implemented, not reviewed; next: independent feature Review. Clarification: ${clarification}.`],
    ["build", `Feature 1; next: validate/fix F1-R1. Latest: ${first}; clarification: ${clarification}. Feature 2 pending.`],
    ["review", `Feature 1; next: independently recheck F1-R1 correction. Latest: ${first}; clarification: ${clarification}. Feature 2 pending.`],
    ["build", `Feature 2; next: implement only next eligible feature. Feature 1 independently reviewed clean; F1-R1 resolved. Latest: ${second}; predecessor: ${first}; clarification: ${clarification}.`],
  ];
  for (const [mode, context] of steps) {
    const notes = `Explicitly authorized implementation loop. ${context}`;
    await h.task("PRIVATE prior feature transcript");
    const previous = h.current, before = h.sessions.length;
    await h.call({ mode, input, notes });
    assert.equal(h.sessions.length, before + 1);
    assert.notEqual(h.current.extension, previous.extension);
    assert.deepEqual(state(h), { mode, input, notes });
    assert.ok(h.current.prompts[0].workflow.includes(notes));
    assert.ok(!h.current.sent[0].content.includes("PRIVATE prior feature transcript"));
    assert.equal(h.current.records.filter((entry) => entry.type === "message").length, 1);
  }
  assert.equal(h.sessions.flatMap((session) => session.selections).length, 0);
  assert.equal(h.sessions.flatMap((session) => session.notices).length, 0);
  for (const path of [input, clarification, first, second]) assert.equal(existsSync(path), false);
});

test("whole-plan Review → focused Build → whole-plan Review preserves blocker/finding context", async (t) => {
  const h = await harness(); t.after(() => h.close());
  const input = join(cwd, "whole-plan.md"), report = join(cwd, "whole-plan-findings.md");
  await h.command("review", input);
  for (const [mode, action] of [["build", "validate/fix WP-R1 integration finding; verify affected Feature 1/2 criteria"], ["review", "fresh whole-plan Review; independently verify WP-R1 correction and every requirement"]]) {
    const notes = `Explicitly authorized implementation loop; whole-plan correction loop; next: ${action}. Latest: ${report}. Features 1/2 reviewed; Feature 3 partial, B1 blocked on required input; no dependent work authorized. Exhaust independent corrections before consolidated blocker questions.`;
    const before = h.sessions.length;
    await h.call({ mode, input, notes });
    assert.equal(h.sessions.length, before + 1);
    assert.deepEqual(state(h), { mode, input, notes });
    assert.ok(h.current.prompts[0].workflow.includes(notes));
    assert.match(h.current.prompts[0].workflow, /whole-plan Review/);
    assert.match(h.current.prompts[0].workflow, /affected feature criteria/);
  }
  assert.equal(h.sessions.flatMap((session) => session.selections).length, 0);
  assert.equal(existsSync(report), false);
});

test("authorized loop contracts defer blockers, exhaust independent work, and keep standalone Review read-only", async (t) => {
  const h = await harness(); t.after(() => h.close());
  for (const mode of ["build", "review"]) {
    await h.command(mode, join(cwd, "original-plan.md"));
    const prompt = h.current.prompts[0].workflow;
    for (const contract of [
      /first eligible feature in plan order unless dependency\/blocker evidence requires another/,
      /same unsuccessful approach without new evidence is not progress; there is no numerical retry cap/,
      /missing consequential decision, unavailable required authority\/input, or demonstrated inability to make further progress/,
      /(?:whole-plan|final-review) corrections are exhausted/,
      /User answers resume the appropriate Build\/Review loop without another start confirmation/,
      /new scope still needs (?:explicit )?approval/,
    ]) assert.match(prompt, contract);
    if (mode === "build") {
      assert.match(prompt, /implement only the selected eligible feature and its necessary checks, not all remaining features/);
      assert.match(prompt, /Validate incoming Review findings against the code/);
      assert.match(prompt, /disputed or unsupported findings with evidence rather than blindly applying them/);
      // F1 blocked, independent F2 continues; dependent F3 must wait.
      assert.match(prompt, /defer blocked work and continue the safe separable remainder of the selected feature/);
      assert.match(prompt, /fresh Build for the next safely independent feature/);
      assert.match(prompt, /Never implement dependent work on guessed answers or repeatedly retry blocked work/);
      // All-blocked or partially completed work still receives whole-plan Review, never a false pass.
      assert.match(prompt, /Once no eligible feature work remains, hand off to fresh whole-plan Review, even for partial implementation/);
      assert.match(prompt, /partial feature is not complete or reviewed/);
      assert.match(prompt, /after whole-plan corrections request fresh whole-plan Review, including affected feature criteria/);
      assert.match(prompt, /Do not independently start reviewing, open a browser, or insert routine approval questions during the loop/);
    } else {
      assert.match(prompt, /Feature scope is semantic, not a guessed Git diff boundary/);
      assert.match(prompt, /selected feature's acceptance criteria, connected code\/tests, and cumulative changes relevant to regressions/);
      assert.match(prompt, /automatically call workflow_handoff for fresh Build of that feature with the same absolute original plan path and exact report\/finding references/);
      assert.match(prompt, /No Plan picker, browser, or routine approval question interrupts feature\/fix\/next transitions/);
      assert.match(prompt, /not human-approved or whole-plan approved, then hand off directly to Build/);
      assert.match(prompt, /Defer blockers while continuing all safe independent work, including a separable remainder of a partially blocked feature; never mark partial work reviewed/);
      assert.match(prompt, /After feature Review, once eligible feature work\/reviews are exhausted, call workflow_handoff for fresh whole-plan Review/);
      assert.match(prompt, /Map every requirement to implementation and checks; inspect cross-feature integration, regressions, missed scope, and unresolved blockers/);
      assert.match(prompt, /Partial implementation can be reviewed but cannot receive a clean whole-plan verdict/);
      assert.match(prompt, /Whole-plan actionable in-scope findings automatically return to focused Build, then fresh whole-plan Review/);
      assert.match(prompt, /Only a whole-plan review with no unresolved actionable findings, incomplete features, or blockers reaches the normal human approval flow/);
      assert.match(prompt, /Standalone \/review never infers implementation authority from a plan filename, prior reports, or numbered features/);
      assert.match(prompt, /it stays read-only and uses the explicit findings-routing choice below/);
      assert.match(prompt, /Review never fixes source itself/);
      assert.match(prompt, /following findings choice applies only without implementation-loop authority/);
      assert.match(prompt, /Standalone findings: show the report and use workflow_question to ask whether to return to Plan/);
      assert.match(prompt, /never a clean feature Review or incomplete\/blocked loop/);
    }
  }
  await h.command("workflow");
  const help = h.current.notices.at(-1).content;
  assert.match(help, /per-feature Build ↔ Review → whole-plan Review ↔ focused Build/);
  assert.match(help, /Standalone \/review stays read-only and asks before findings routing/);
});

const codeReviewDecision = {
  question: "Automated review is clean. Review code or approve and continue?",
  options: ["Review code in Plannotator", "Approve code and go to UI", "Approve code, skip UI, and go to Finalize"],
};

// Scripted selections/handoffs test transport, not model decisions or browser execution.
for (const choice of [...codeReviewDecision.options, undefined]) test(`clean-review menu: ${choice ?? "cancel"} authorizes only its selected action`, async (t) => {
  const h = await harness({ select: () => choice }); t.after(() => h.close());
  const input = join(cwd, "resolved-original-plan.md");
  const reports = ["clarification", "feature-1", "feature-2", "blocker", "whole-plan", "human-feedback"].map((name) => join(cwd, `${name}.md`));
  await h.command("review", join(cwd, "standalone-reference.md"));
  const before = h.sessions.length, session = h.current;
  const result = await h.call(codeReviewDecision, undefined, "workflow_question");
  assert.deepEqual(session.selections[0].options, codeReviewDecision.options);
  assert.equal(h.sessions.length, before, "selection never dispatches a destination");
  assert.equal(session.sent.length, 1);
  if (choice === undefined) {
    assert.equal(result.details.status, "cancelled");
    assert.equal(result.terminate, true);
    await h.task("Resume in chat");
    assert.equal(session.selections.length, 1, "no automatic reopen");
  } else {
    assert.deepEqual(result.details, { status: "selected", choice });
    if (choice !== codeReviewDecision.options[0]) {
      const mode = choice === codeReviewDecision.options[1] ? "ui" : "finalize";
      const notes = `Explicit code approval: ${choice}. Artifacts: ${reports.join("; ")}. Accepted limitation: live checks deferred by user.`;
      await h.call({ mode, input, notes });
      assert.equal(h.sessions.length, before + 1);
      assert.deepEqual(state(h), { mode, input, notes });
      for (const path of reports) assert.ok(h.current.prompts[0].workflow.includes(path));
      assert.equal(h.sessions.flatMap((item) => item.selections).length, 1, "no extra destination picker");
    }
  }
});

test("clean-review prompt makes browser review opt-in and preserves approval, scope, and feedback safeguards", async (t) => {
  const h = await harness(); t.after(() => h.close());
  await h.command("review", "reference.md");
  const prompt = h.current.prompts[0].workflow;
  const review = prompt.slice(prompt.indexOf("# Review"));
  const menu = review.match(/use workflow_question with exactly these three actions, in order: ([^\n]+)/)?.[1];
  assert.ok(menu);
  assert.deepEqual([...menu.matchAll(/"([^"]+)"/g)].map((match) => match[1]), codeReviewDecision.options);
  for (const contract of [
    /clean standalone or clean whole-plan Review, never a clean feature Review or incomplete\/blocked loop/,
    /Never open code review merely because automated review completed/,
    /Resolve the original implementation-plan reference through the supplied reference\/reports before UI\/Finalize routing/,
    /ask in chat if missing or ambiguous, never guess the latest plan or substitute a report/,
    /Either direct approval choice: call workflow_handoff once for its named phase/,
    /Do not ask an extra UI-or-Finalize question or open a browser/,
    /only opts into browser review; it does not approve code or authorize UI\/Finalize/,
    /Before opening, explain the approval gate.*plain close may send no message and they can resume in chat/,
    /Open ordinary Plannotator code review with gate: true.*then end the turn/,
    /Default is this project's uncommitted changes/,
    /--diff-type uncommitted.*saved browser preferences can differ/,
    /Ask the user to verify\/change the comparison/,
    /explicit branch base use the tool's options.base.*never silently choose a different scope/,
    /Human annotations: save a new standalone feedback report.*preserve the originals/,
    /requests to revalidate, not proven defects or automatically authorized new scope/,
    /workflow_question for Plan \(revalidate feedback\) or proceed without replanning/,
    /proceeding leaves the requests unimplemented/,
    /After explicit browser approval.*workflow_question to ask UI .* or Finalize .*unless the user already explicitly specified the destination/,
    /Silent close, cancellation, empty feedback without explicit approval, failed browser opening, or unavailable UI is not approval and authorizes no destination/,
    /without UI, ask the returned question\/options in chat/,
    /cancelled picker means wait for chat without dispatching or reopening/,
    /all known same-task clarification, feature-review, blocker, whole-plan review, and human feedback reports/,
    /forwarding paths from incoming notes/,
    /material decisions, accepted deferrals\/limitations and their documented reasons/,
  ]) assert.match(review, contract);
  await h.command("workflow");
  for (const action of codeReviewDecision.options) assert.ok(h.current.notices.at(-1).content.includes(action));
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
  const menu = await h.call(codeReviewDecision, undefined, "workflow_question");
  assert.deepEqual(menu.details, { status: "unavailable", ...codeReviewDecision });
  for (const action of codeReviewDecision.options) assert.ok(menu.content[0].text.includes(action));
  assert.equal(h.sessions.length, before, "unavailable menu authorizes no destination");
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

test("every phase loads exactly its skills on entry and resume; missing skills warn and continue", async (t) => {
  const expected = { plan: ["plannotator"], build: ["ponytail"], review: ["ponytail-review", "plannotator"], ui: ["plannotator"], finalize: [] };
  const h = await harness(); t.after(() => h.close());
  const missing = await harness({ skills: [] }); t.after(() => missing.close());
  for (const mode of modes) {
    await h.command(mode, "plan.md");
    assert.ok(h.current.sent[0].content.startsWith(`Begin ${mode}`));
    assert.equal(h.current.sent[0].options.expandPromptTemplates, false);
    const check = (prompt) => {
      assert.deepEqual([...prompt.workflow.matchAll(/<skill name="([^"]+)"/g)].map((match) => match[1]), expected[mode]);
      for (const name of expected[mode]) {
        const skill = skillFixtures.find((item) => item.name === name);
        assert.ok(prompt.workflow.includes(`location="${skill.filePath}"`));
        assert.ok(prompt.workflow.includes(`References are relative to ${skill.baseDir}.`));
        assert.ok(prompt.workflow.includes(readFileSync(skill.filePath, "utf8")));
      }
    };
    check(h.current.prompts[0]);
    await h.resume(h.current.records);
    assert.equal(h.current.sent.length, 0, "resume must not dispatch work");
    check(await h.task());
    await missing.command(mode, "plan.md");
    assert.equal(missing.current.notifications.filter(({ text }) => text.startsWith("Skill ")).length, expected[mode].length);
    assert.doesNotMatch(missing.current.prompts[0].workflow, /<skill name=/);
  }
});

test("an unreadable skill warns without dropping the other phase skill", async (t) => {
  const skill = skillFixtures.find((item) => item.name === "plannotator");
  const original = skill.filePath;
  skill.filePath = join(skill.baseDir, "missing.md");
  t.after(() => { skill.filePath = original; });
  const h = await harness(); t.after(() => h.close());
  await h.command("review", "plan.md");
  assert.match(h.current.prompts[0].workflow, /Fixture instructions for ponytail-review/);
  assert.doesNotMatch(h.current.prompts[0].workflow, /<skill name="plannotator"/);
  assert.ok(h.current.notifications.some(({ text }) => text.startsWith("Skill plannotator unavailable")));
});

test("resume restores phase/input without queuing work; tree navigation follows only its active branch", async (t) => {
  const h = await harness(); t.after(() => h.close());
  await h.command("ui", "plan.md");
  const records = structuredClone(h.current.records);
  await h.resume(records);
  assert.deepEqual(state(h), { mode: "ui", input: "plan.md" });
  assert.deepEqual(h.current.statuses.at(-1), badgeStatus("ui", "#000000"));
  assert.equal(h.current.sent.length, 0);
  assert.deepEqual(h.current.active, [...normalTools, ...workflowTools, "workflow_ui_server"]);
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
    assert.ok(prompt.includes("~/.pi/plans/<project-key>/<task-id>.md"));
    assert.ok(prompt.includes("~/.pi/reviews/<project-key>/<task-id>-<topic>-<UTC timestamp>.md"));
    assert.match(prompt, /user\/task paths or applicable project-owned workflow\/agent instructions take precedence per artifact type/);
    assert.match(prompt, /a path for one type does not redirect another/);
    assert.match(prompt, /validated task association's projectKey and id from the recorded canonical repository/);
    assert.match(prompt, /never the generated worktree basename or task prose/);
    assert.match(prompt, /Preserve exact original-plan, predecessor, and report references/);
    assert.match(prompt, /Clarify conflicting\/shared targets before overwriting/);
    assert.match(prompt, /choose a new filename if a new report's default already exists/);
    assert.match(prompt, /Existing directories or historical files alone are not overrides/);
    assert.match(prompt, /instruction-only defaults, not enforced locations/);
    assert.match(prompt, /Expand ~ before calling filesystem tools/);
    assert.doesNotMatch(prompt, /(?<!~\/)\.pi\/(?:plans|reviews)\//);
  }
  for (const [mode, path] of [["plan", "~/.pi/plans/<project-key>/<task-id>.md"], ["review", "~/.pi/reviews/<project-key>/<task-id>-<topic>-<UTC timestamp>.md"]]) {
    const prompt = readFileSync(join(workflow, `${mode}.md`), "utf8");
    assert.ok(prompt.includes(path));
    assert.match(prompt, /explicit user\/task or applicable project-instructed location for that artifact type/);
    assert.match(prompt, /instruction-only, not enforced/);
  }
  assert.equal(existsSync(join(cwd, ".pi/plans/task.md")), false);
  assert.deepEqual([...h.current.extension.tools.keys()], [...workflowTools, "workflow_ui_server"]);
});

test("task artifact defaults remain distinct and review targets the checkout root across subdirectory handoffs", async (t) => {
  const source = freshSource("artifact-identity");
  const a = await harness({ directory: join(source, "sub dir") }), b = await harness({ directory: source });
  t.after(() => { a.close(); b.close(); });
  await Promise.all([a.command("plan", "same prose"), b.command("plan", "same prose")]);
  const first = taskState(a), second = taskState(b);
  assert.equal(first.projectKey, second.projectKey);
  assert.notEqual(first.id, second.id);
  for (const h of [a, b]) {
    const data = taskState(h), plan = `~/.pi/plans/${data.projectKey}/${data.id}.md`;
    assert.ok(h.current.prompts[0].workflow.includes(`Default plan: ${plan}`));
    await h.command("workflow");
    const help = h.current.notices.at(-1).content;
    for (const text of [data.repository, data.id, plan, `Task checkout / Plannotator code-review target: ${data.root}`]) assert.ok(help.includes(text));
  }
  const input = "/explicit old plans/original.md", predecessor = "/shared reports/previous.md";
  for (const mode of modes) {
    const notes = `Explicit artifact override: /project/plans/chosen.md; predecessor: ${predecessor}`;
    await a.call({ mode, input, notes });
    const prompt = a.current.prompts[0].workflow;
    assert.equal(a.current.ctx.cwd, join(first.root, "sub dir"));
    assert.ok(prompt.includes(`Default plan: ~/.pi/plans/${first.projectKey}/${first.id}.md`));
    assert.ok(prompt.includes(`Task checkout / Plannotator code-review target: ${first.root}`));
    assert.ok(prompt.includes(input)); assert.ok(prompt.includes(notes));
    if (mode === "review") assert.match(prompt, /explicitly passing the validated task checkout root as target \(not the source checkout or application subdirectory\)/);
  }
  const fresh = await harness({ directory: join(first.root, "sub dir") }); t.after(() => fresh.close());
  await fresh.command("workflow");
  assert.ok(fresh.current.notices.at(-1).content.includes(`Default plan: ~/.pi/plans/${first.projectKey}/${first.id}.md`));
  assert.equal(fresh.current.sent.length, 0, "help discovers association without starting a phase");
  assert.equal(existsSync(join(temp, ".pi", "plans")), false, "defaults do not create artifacts");
});

test("workflow help does not invent artifact identity for unmanaged or legacy sessions", async (t) => {
  const source = freshSource("help-unmanaged");
  const h = await harness({ directory: source }); t.after(() => h.close());
  await h.command("workflow");
  assert.match(h.current.notices.at(-1).content, /No managed task worktree/);
  assert.doesNotMatch(h.current.notices.at(-1).content, /Default plan:/);
  await h.tree([{ type: "custom", customType: "workflow-phase", data: { mode: "review", input: "/exact/legacy.md" } }]);
  await h.command("workflow");
  assert.match(h.current.notices.at(-1).content, /Workflow paused:.*Legacy\/unassociated/);
  assert.doesNotMatch(h.current.notices.at(-1).content, /Default plan:/);
  assert.equal(h.sessions.length, 1); assert.equal(h.current.sent.length, 0);
});

test("phase authority narrowly permits setup, UI lifecycle and authorized Finalize publication", async (t) => {
  const h = await harness(); t.after(() => h.close());
  for (const mode of modes) {
    await h.command(mode, "/exact/original.md");
    const prompt = h.current.prompts[0].workflow;
    assert.match(prompt, /Extension-driven task branch\/worktree setup and authorized Finalize task-only publication are narrow automatic Git-write exceptions/);
    assert.match(prompt, /After setup Plan is non-mutating research/);
    assert.match(prompt, /Build and Review remain Git-read-only outside explicitly authorized disposable test fixtures/);
    assert.match(prompt, /UI alone may use workflow_ui_server for an inspected existing dev command in this task checkout/);
    assert.match(prompt, /A standalone Review or documentation-only Finalize grants no publication authority/);
    assert.match(prompt, /no general Git, service, credential, destructive, installation, or deployment authority/);
  }
  const agents = readFileSync(resolve(workflow, "../AGENTS.md"), "utf8");
  assert.match(agents, /setup is not general agent Git-write authority/);
  assert.match(agents, /Never alter unrelated work or rewrite history without specific authority/);
});

test("Plan limits scope and conditionally grills through Plannotator without changing final approval", () => {
  const plan = readFileSync(join(workflow, "plan.md"), "utf8");
  assert.match(plan, /only user-requested or explicitly user-approved scope/);
  assert.match(plan, /Derive necessary implementation steps and checks without per-file\/test approval/);
  assert.match(plan, /do not treat recommendations, inferred preferences, or unrelated improvements as requirements/);
  assert.match(plan, /After research, grill consequential missing details, assumptions, and discretionary recommendations/);
  assert.match(plan, /If any exist, save a separate clarification document using the Plan feedback artifact rules/);
  assert.match(plan, /contextual Plannotator question blocks: explain consequences, give a recommendation and rationale when applicable, and offer rejection of optional additions/);
  assert.match(plan, /installed plannotator tool, end the turn, and wait for answers; follow up only on remaining consequential uncertainty/);
  assert.match(plan, /If no real questions exist, proceed directly to normal plan review; never invent a grilling round/);
  assert.match(plan, /only after an explicit answer or approval clearly covers that proposal/);
  assert.match(plan, /Silence, skipped questions, dismissal, tool failures, or approval of another item authorize nothing/);
  assert.match(plan, /Keep unanswered or rejected proposals out of implementation scope; pause if an unanswered question blocks requested behavior/);
  assert.match(plan, /Record settled decisions in the standalone plan/);
  assert.match(plan, /Never use final plan approval to retroactively legitimize silently inserted scope/);
  assert.match(plan, /Planning clarification and proposed-scope questions use Plannotator, not workflow_question or automatic chat fallback/);
  assert.match(plan, /overrides generic question-routing\/fallback guidance for those questions/);
  assert.match(plan, /If Plannotator is unavailable, pause unresolved scope decisions until it works or the user explicitly authorizes another channel/);
  assert.match(plan, /Closing without answers chooses no default and authorizes no handoff/);
  assert.match(plan, /Workflow navigation still uses workflow_question for finite choices and chat for free-form direction/);
  assert.match(plan, /Opening or answering a grilling document neither approves the implementation plan nor authorizes Build/);
  assert.match(plan, /Explicit browser or chat approval: call workflow_handoff for Build/);
});

test("feature identity and cumulative progress contracts preserve original plans and older-plan compatibility", async (t) => {
  const h = await harness(); t.after(() => h.close());
  await h.command("plan", "Task with multiple features");
  const plan = h.current.prompts[0].workflow;
  for (const contract of [
    /one original plan with numbered features and stable feature identifiers/,
    /acceptance criteria per feature, ordered implementation steps, and explicit dependencies/,
    /Do not turn each file or test into a feature or split features into separately approved plans/,
    /single-feature or older unnumbered plan remains usable as one implementation unit/,
    /clarify only genuinely ambiguous feature divisions or dependencies/,
    /not a progress checklist to rewrite during implementation/,
  ]) assert.match(plan, contract);
  for (const mode of ["build", "review"]) {
    await h.command(mode, join(cwd, "original-plan.md"));
    const prompt = h.current.prompts[0].workflow;
    for (const contract of [
      /complete original plan, applicable instructions, and latest same-task progress\/review references/,
      /explicit loop authorization \(never infer it from a filename or report\)/,
      /current stable feature identity or whole-plan review kind, next action, and absolute progress\/report references/,
      /forward predecessor and clarification paths/,
      /Preserve the original plan and earlier reports until Finalize's bounded consolidation/,
      /single-feature or older unnumbered plan is one implementation unit/,
    ]) assert.match(prompt, contract);
    if (mode === "build") {
      assert.match(prompt, /If a blocker prevents a normal Review handoff, save a focused standalone blocker\/progress report under the shared review-report path rules/);
      assert.match(prompt, /cumulative feature states, dependencies and blockers, unresolved requirements\/findings with stable IDs and status, evidence and actual checks, what can safely continue, and next eligible work/);
      assert.match(prompt, /partial feature is not complete or reviewed/);
    } else {
      assert.match(prompt, /report is also the cumulative progress snapshot/);
      assert.match(prompt, /all feature states and dependency\/blocker relationships/);
      assert.match(prompt, /stable finding IDs and their open\/resolved\/disputed status with evidence, actual checks, next action and next eligible work/);
      assert.match(prompt, /Carry forward unresolved findings\/blockers; do not mark partial features complete or reviewed/);
      assert.match(prompt, /resume without the prior transcript and preserve older reports and their paths; do not rewrite the original plan to track progress/);
    }
  }
});

test("Finalize delivers bounded decision consolidation and ordered cleanup, not an artifact runner", async (t) => {
  const h = await harness(); t.after(() => h.close());
  await h.command("finalize", join(cwd, "implementation-plan.md"));
  const prompt = h.current.prompts[0].workflow;
  for (const contract of [
    /Direct \/finalize or an authorized handoff is sufficient instruction to start/,
    /resolve its actual implementation plan through its references; ask if the target plan is ambiguous or missing/,
    /Keep the existing implementation-plan path as the surviving summary/,
    /concrete set of eligible source paths before editing: only the current task's/,
    /Read these inputs completely/,
    /reports that reference the plan but are not linked from it/,
    /not every historical link/,
    /Do not bulk-read project history or infer membership from filename prefix or modification time alone/,
    /outside normal artifact folders is not automatically eligible for deletion/,
    /task membership, shared artifacts, target paths, conflicting decisions, unreadable inputs, or relevant outcomes\/reasons remain unclear/,
    /do not invent rationale, treat proposals as approval, or call unresolved findings fixed/,
    /concise standalone final decision record identifying the task and its final choices with documented reasons/,
    /Merge repeated choices, replace superseded proposals/,
    /keep rejected alternatives only when they explain that position/,
    /Retain accepted limitations and deferred findings with their reasons/,
    /Exclude implementation checklists, session routing, review ceremony, raw test output/,
    /Do not leave links to artifacts being deleted/,
    /preserve input reports and earlier review reports in Plan, Build, Review, and UI/,
    /Finalize alone may replace the current task's implementation plan/,
    /Fully read and consolidate all eligible inputs before replacing the plan/,
    /Write the complete summary at the target plan path, then read it back and verify/,
    /Only after successful verification delete the exact other task artifact paths already identified and fully consolidated/,
    /Never delete the surviving summary, parent directories, unrelated\/shared artifacts, source\/configuration files, journals, session logs, or Plannotator history/,
    /If summary write\/readback or verification fails, perform no cleanup/,
    /If deletion partially fails, preserve the summary and remaining files and report exactly what remains/,
    /Do not promise transactional rollback or automatic recovery/,
    /On repeated Finalize, read the existing summary, preserve its decisions, avoid duplicate entries and unrelated cleanup/,
    /no new task inputs means no substantive rewrite/,
    /Update only journals\/logs explicitly required/,
    /Do not edit source, instructions, or unrelated docs/,
    /After any documentation\/bookkeeping edits, verify all files changed in Finalize/,
    /applicable project formatting, Markdown, and documentation lint rules/,
    /Inspect existing configuration\/scripts first/,
    /run relevant installed checks in non-fixing mode, scoped to those files where supported/,
    /Correct only formatting\/lint issues introduced by Finalize within its allowed edit scope/,
    /rerun the affected checks after the last edit/,
    /Do not install tools, change configuration, or reformat unrelated content/,
    /If no automated check applies, inspect the changed text.*verification was manual/,
    /Report actual results, unavailable checks, and unresolved or pre-existing issues/,
    /do not claim earlier checks cover later edits/,
    /If summary formatting verification fails, perform no artifact cleanup/,
    /Do not run tests, unrelated checks, or installs/,
    /only the scoped documentation formatting\/lint checks above are automatic/,
    /formatting\/lint verification results and any evidence limitations/,
    /Only the task-scoped staging, signed commit, normal SSH push and gh PR sequence below is a Git\/publication exception/,
    /Suggest exactly one single-line Conventional Commit subject for the complete task from its start/,
    /Finish with the summary path, cleanup results or exact remaining artifacts\/limitations/,
    /For documentation-only Finalize, remain in this session unless explicitly asked to exit/,
  ]) assert.match(prompt, contract);
  assert.ok(prompt.indexOf("Fully read and consolidate") < prompt.indexOf("Write the complete summary"));
  assert.ok(prompt.indexOf("Write the complete summary") < prompt.indexOf("Only after successful verification delete"));
  assert.ok(prompt.indexOf("applicable formatting rules are respected") < prompt.indexOf("Only after successful verification delete"));
  assert.doesNotMatch(prompt, /make no document writes|Do not edit source, plans/);
  assert.deepEqual([...h.current.extension.tools.keys()], [...workflowTools, "workflow_ui_server"]);
  assert.equal(existsSync(join(cwd, "implementation-plan.md")), false, "prompt injection must not write or delete artifacts");
});

test("Review to UI to Finalize forwards artifact paths and decision guidance through existing notes", async (t) => {
  const h = await harness(); t.after(() => h.close());
  const input = join(cwd, "implementation-plan.md");
  const reports = [join(cwd, "review.md"), join(cwd, "ui-feedback.md")];
  await h.command("review", input);
  const review = h.current.prompts[0].workflow;
  assert.match(review, /notes for UI or Finalize, carry concise absolute paths to all known same-task clarification, feature-review, blocker, whole-plan review, and human feedback reports/);
  assert.match(review, /forwarding paths from incoming notes/);
  assert.match(review, /accepted deferrals\/limitations and their documented reasons/);
  assert.match(review, /original implementation-plan reference; a Plan route instead receives the findings\/feedback report/);
  await h.call({ mode: "ui", input, notes: `${reports[0]} — deferred live check: user will test locally` });
  const ui = h.current.prompts[0].workflow;
  assert.match(ui, /with the original implementation-plan reference/);
  assert.match(ui, /forward concise absolute paths to known same-task artifacts from incoming notes and any new UI feedback report/);
  assert.match(ui, /accepted deferrals\/limitations and their documented reasons/);
  assert.match(ui, /Do not replace the primary plan with a report list or transfer the transcript/);
  assert.ok(ui.includes(reports[0]));
  const notes = `${reports.join("; ")} — accepted limitation: live check deferred to local user testing`;
  await h.call({ mode: "finalize", input, notes });
  assert.deepEqual(state(h), { mode: "finalize", input, notes });
  assert.ok(h.current.prompts[0].workflow.includes(notes));
  assert.equal(h.current.selections.length, 0, "authorized handoffs add no approval gate");
});

test("UI feedback routes directly to a focused correction loop or Plan without an ignore picker", async (t) => {
  const h = await harness(); t.after(() => h.close());
  const input = join(cwd, "implementation-plan.md"), feedback = join(cwd, "ui-feedback.md");
  const notes = `Explicitly authorized focused UI-correction Build ↔ Review loop; return to UI after clean whole-plan Review. Supplemental acceptance criteria: ${feedback}. Reviewed user-managed URL: http://localhost:3000/settings#profile`;
  await h.command("ui", input);
  const ui = h.current.prompts[0].workflow;
  for (const contract of [
    /Requested changes \(in annotations or chat\) authorize addressing that feedback/,
    /small, clear, localized corrections within the existing design/,
    /automatically call workflow_handoff for Build with the original implementation-plan path/,
    /feedback report as supplemental acceptance criteria/,
    /preserve the reviewed URL\/route and ownership context/,
    /hand off directly to Plan with the feedback report/,
    /Never infer approval from comments, even when submitted with approval/,
  ]) assert.match(ui, contract);
  assert.doesNotMatch(ui, /workflow_question to ask whether to return to Plan/);
  await h.call({ mode: "build", input, notes });
  assert.match(h.current.prompts[0].workflow, /Do not expand this into next-feature work/);
  assert.match(h.current.prompts[0].workflow, /carry its acceptance criteria and explicit return-to-UI instruction through every handoff/);
  await h.call({ mode: "review", input, notes });
  const review = h.current.prompts[0].workflow;
  assert.match(review, /read the linked UI feedback as supplemental acceptance criteria/);
  assert.match(review, /actionable in-scope findings return automatically to focused Build/);
  assert.match(review, /After clean whole-plan Review, follow the explicit return-to-UI instruction automatically/);
  assert.match(review, /Do not insert the normal code-approval picker or go to Finalize/);
  await h.call({ mode: "build", input, notes });
  await h.call({ mode: "review", input, notes });
  await h.call({ mode: "ui", input, notes });
  assert.deepEqual(state(h), { mode: "ui", input, notes });
  assert.ok(h.current.prompts[0].workflow.includes(notes));
  await h.call({ mode: "plan", input: feedback, notes: `Original plan: ${input}; needs a consequential user decision` });
  assert.match(h.current.prompts[0].workflow, /grill consequential missing details/);
  assert.equal(state(h).input, feedback);
  assert.ok(h.sessions.every((session) => session.selections.length === 0));
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
  assert.match(read("ui"), /Do not ask whether to return to Plan or leave the requests unimplemented/);
  assert.match(read("ui"), /workflow_question to ask whether to retry live review, skip to Finalize, or change direction/);
  assert.match(read("ui"), /Explicit approval of the live UI/);
  assert.match(read("build"), /call workflow_handoff for Review with the same absolute plan path/);
  assert.match(read("ui"), /cannot force --app/);
  assert.match(read("ui"), /live and may change real data/);
  assert.match(read("finalize"), /If no journals are required, skip journal writes/);
  assert.match(read("finalize"), /complete task from its start/);
  for (const mode of modes) assert.doesNotMatch(read(mode), /workflow_(?:save_artifact|submit_plan|git|check|ui_review|finish)/);
});


for (const mode of ["rpc", "print"]) test(`clean ${mode} Plan entry needs no permission dialog and binds the real task cwd`, async (t) => {
  const source = freshSource(mode);
  const h = await harness({ directory: source, mode }); t.after(() => h.close());
  await h.command("plan", "task");
  assert.equal(h.current.ctx.cwd, taskState(h).root);
  assert.equal(h.sessions[0].selections.length, 0);
  assert.match(h.current.sent[0].content, /Begin plan now/);
});

test("separate launching checkout shares stable project identity but starts at its own commit", async (t) => {
  const source = freshSource("shared-repo"), other = join(temp, `other-checkout-${randomUUID()}`);
  git(source, "worktree", "add", "-b", "stack", other, "HEAD");
  writeFileSync(join(other, "stack-only"), "committed stack"); git(other, "add", "stack-only");
  git(other, "-c", "commit.gpgsign=false", "commit", "-m", "stack fixture");
  const a = await harness({ directory: source }), b = await harness({ directory: other }); t.after(() => { a.close(); b.close(); });
  await a.command("plan", "base task"); await b.command("plan", "stacked task");
  assert.equal(taskState(a).projectKey, taskState(b).projectKey);
  assert.equal(taskState(a).repository, taskState(b).repository);
  assert.notEqual(taskState(a).commit, taskState(b).commit);
  assert.equal(existsSync(join(taskState(a).root, "stack-only")), false);
  assert.equal(existsSync(join(taskState(b).root, "stack-only")), true);
});

test("worktree-add failure retains partial setup with recovery paths and never adopts it on retry", async (t) => {
  const source = freshSource("hook-failure");
  const hooks = join(source, ".git", "hooks");
  writeFileSync(join(hooks, "post-checkout"), "#!/bin/sh\nexit 1\n", { mode: 0o755 });
  const h = await harness({ directory: source }); t.after(() => h.close());
  await h.command("plan", "task");
  assert.equal(h.sessions.length, 1); assert.equal(h.current.sent.length, 0);
  assert.match(notifications(h), /Setup may have retained branch pi\/.*No rollback performed/s);
  assert.equal(git(source, "worktree", "list", "--porcelain").split("worktree ").length, 3);
  await h.command("plan", "retry");
  assert.equal(h.sessions.length, 1);
  assert.equal(git(source, "worktree", "list", "--porcelain").split("worktree ").length, 4, "retry allocates a different task, never adopts partial setup");
  assert.equal(git(source, "branch", "--show-current"), "main");
});

test("an existing branch/path collision is never adopted or overwritten", async (t) => {
  const source = freshSource("collision");
  const a = await harness({ directory: source }), b = await harness({ directory: source }); t.after(() => { a.close(); b.close(); });
  await a.command("plan", "first");
  const data = taskState(a), marker = join(data.root, "pending"); writeFileSync(marker, "preserve");
  const before = git(source, "worktree", "list", "--porcelain");
  const original = crypto.randomUUID;
  try {
    crypto.randomUUID = () => data.id; syncBuiltinESMExports();
    await b.command("plan", "collision");
  } finally { crypto.randomUUID = original; syncBuiltinESMExports(); }
  assert.equal(b.sessions.length, 1); assert.equal(b.current.sent.length, 0);
  assert.match(notifications(b), /could not start plan/);
  assert.equal(git(source, "worktree", "list", "--porcelain"), before);
  assert.equal(readFileSync(marker, "utf8"), "preserve");
});

test("entry-session persistence failure retains the task and does not switch or prompt", async (t) => {
  const source = freshSource("persist-failure"), notDirectory = join(temp, `not-directory-${randomUUID()}`);
  writeFileSync(notDirectory, "existing file");
  const h = await harness({ directory: source }); t.after(() => h.close());
  h.current.ctx.sessionManager.getSessionDir = () => notDirectory;
  await h.command("plan", "task");
  assert.equal(h.sessions.length, 1); assert.equal(h.current.sent.length, 0);
  assert.match(notifications(h), /Retained workspace:/);
  assert.match(notifications(h), /ENOTDIR/);
  assert.equal(readFileSync(notDirectory, "utf8"), "existing file");
  assert.equal(git(source, "worktree", "list", "--porcelain").split("worktree ").length, 3);
});

for (const via of ["command", "helper", "fresh-instance"]) test(`requested ${via} exit returns to ordinary Pi and preserves dirty task/source`, async (t) => {
  const source = freshSource("exit spaces $()"), originalCwd = join(source, "sub dir");
  const h = await harness({ directory: originalCwd }); t.after(() => h.close());
  await h.command("plan", "task");
  const data = taskState(h), records = structuredClone(h.current.records);
  writeFileSync(join(source, "tracked"), "source staged\n"); git(source, "add", "tracked");
  writeFileSync(join(source, "tracked"), "source unstaged\n");
  writeFileSync(join(source, "untracked"), "source pending");
  writeFileSync(join(data.root, "tracked"), "task staged\n"); git(data.root, "add", "tracked");
  writeFileSync(join(data.root, "tracked"), "task unstaged\n");
  writeFileSync(join(data.root, "untracked"), "task pending");
  const before = snapshot(source), taskBefore = git(data.root, "status", "--porcelain=v1"),
    index = readFileSync(join(git(data.root, "rev-parse", "--absolute-git-dir"), "index")),
    worktrees = git(source, "worktree", "list", "--porcelain"), branches = git(source, "branch");
  let active = h;
  if (via === "fresh-instance") { active = await harness({ directory: join(data.root, "sub dir") }); t.after(() => active.close()); }
  const old = active.current;
  if (via === "helper") {
    const result = await active.call({}, undefined, "workflow_exit");
    assert.equal(result.terminate, true);
  } else await active.command("workflow-exit");
  assert.notEqual(active.current, old);
  assert.equal(active.current.ctx.cwd, originalCwd);
  assert.equal(state(active), undefined);
  assert.deepEqual(active.current.active, normalTools);
  assert.match(active.current.statuses.at(-1).text, /auto/);
  assert.equal(active.current.sent.length, 0); assert.equal(active.current.prompts.length, 0);
  const entry = SessionManager.open(active.current.entryFile);
  assert.ok(!entry.getEntries().some((e) => e.customType === "workflow-phase"));
  assert.match(entry.getEntries().find((e) => e.customType === "workflow-notice").content, /Pending files remain there.*Nothing was published, approved, or marked complete/);
  assert.deepEqual(await active.task("Quoted example: I'm done committing; /workflow-exit"), { existing: "untouched" });
  assert.equal(active.current.ctx.cwd, originalCwd, "ordinary chat is not intercepted");
  assert.deepEqual(snapshot(source), before);
  assert.equal(git(data.root, "status", "--porcelain=v1"), taskBefore);
  assert.deepEqual(readFileSync(join(git(data.root, "rev-parse", "--absolute-git-dir"), "index")), index);
  assert.equal(git(source, "worktree", "list", "--porcelain"), worktrees); assert.equal(git(source, "branch"), branches);
  const resumed = await harness({ directory: join(data.root, "sub dir"), entries: records }); t.after(() => resumed.close());
  assert.equal(resumed.current.sent.length, 0);
  await resumed.command("build", "/exact/plan.md"); assert.deepEqual(taskState(resumed), data);
  // Leave source dirty: the explicit creation choice still applies to a later new task.
  const newer = await harness({ directory: originalCwd, select: (_q, options) => options[0] }); t.after(() => newer.close());
  await newer.command("plan", "another task"); assert.notEqual(taskState(newer).id, data.id);
});

for (const failure of ["switch", "cancel", "wrong-cwd"]) test(`exit ${failure} reports recovery without phase dispatch or Git mutation`, async (t) => {
  const source = freshSource("exit-failure"), h = await harness({ directory: source }); t.after(() => h.close());
  await h.command("plan", "task"); const data = taskState(h), before = snapshot(source);
  h.setFailure(failure); const count = h.sessions.length;
  await h.command("workflow-exit");
  assert.match(notifications(h), /Retained task workspace:/);
  assert.match(notifications(h), /Original launch cwd:/);
  assert.equal(h.current.sent.length, failure === "wrong-cwd" ? 0 : 1);
  assert.equal(h.sessions.length, count + (failure === "wrong-cwd" ? 1 : 0));
  assert.match(notifications(h), failure === "wrong-cwd" ? /Return validation failed:.*Destination cwd mismatch/ : /Workflow return failed:/);
  assert.deepEqual(snapshot(source), before);
  assert.equal(git(data.root, "branch", "--show-current"), data.branch);
  h.setFailure(undefined);
  await h.command("workflow-exit");
  // Wrong-cwd entered an ordinary session in the task; the command still resolves its descriptor.
  assert.equal(h.current.ctx.cwd, source); assert.equal(state(h), undefined);
  assert.equal(h.current.sent.length, 0);
});

test("exit helper abort, queue failure and dropped dispatch never claim success; ordinary helper stays inactive", async (t) => {
  const h = await harness(); t.after(() => h.close());
  await assert.rejects(() => h.call({}, undefined, "workflow_exit"), /phase-scoped/);
  await h.command("build", "plan.md"); const count = h.sessions.length;
  await assert.rejects(() => h.call({}, AbortSignal.abort(), "workflow_exit"), /cancelled/);
  h.current.ctx.signal = AbortSignal.abort();
  await assert.rejects(() => h.call({}, undefined, "workflow_exit"), /cancelled/);
  await h.command("workflow-exit"); assert.equal(h.sessions.length, count);
  h.current.ctx.signal = undefined;
  for (const failure of ["queue", "drop"]) {
    h.setFailure(failure); const result = await h.call({}, undefined, "workflow_exit");
    assert.equal(result.isError, failure === "queue" ? true : undefined);
    assert.match(result.content[0].text, /\/workflow-exit/); assert.equal(h.sessions.length, count);
  }
});

test("exit refuses missing/mismatched source and unassociated/legacy state without switching", async (t) => {
  for (const damage of ["missing", "repository", "legacy", "unmanaged"]) {
    const source = freshSource("exit-invalid"), h = await harness({ directory: source }); t.after(() => h.close());
    if (damage !== "unmanaged") await h.command("plan", "task");
    if (damage === "missing") rmSync(join(source, "sub dir"), { recursive: true });
    if (damage === "missing") {
      // Point the recorded launch directory to the now-missing source subdirectory.
      const data = taskState(h); data.originalCwd = join(source, "sub dir");
      writeFileSync(join(git(data.root, "rev-parse", "--absolute-git-dir"), "workflow-task.json"), JSON.stringify(data));
    }
    if (damage === "repository") {
      const data = taskState(h), other = freshSource("wrong-original"); data.sourceRoot = other; data.originalCwd = other;
      writeFileSync(join(git(data.root, "rev-parse", "--absolute-git-dir"), "workflow-task.json"), JSON.stringify(data));
    }
    if (damage === "legacy") await h.tree([{ type: "custom", customType: "workflow-phase", data: { mode: "build", input: "old.md" } }]);
    const count = h.sessions.length; await h.command("workflow-exit");
    assert.equal(h.sessions.length, count); assert.match(notifications(h), /Workflow return failed:/);
  }
});

for (const via of ["command", "helper"]) test(`exit ${via} refuses an unrelated repository at the original launch subdirectory`, async (t) => {
  const source = freshSource("exit-nested-source"), originalCwd = join(source, "sub dir");
  const h = await harness({ directory: originalCwd }); t.after(() => h.close());
  await h.command("plan", "task");
  const data = taskState(h), active = h.current;
  writeFileSync(join(data.root, "tracked"), "task staged\n"); git(data.root, "add", "tracked");
  writeFileSync(join(data.root, "tracked"), "task unstaged\n");
  writeFileSync(join(data.root, "untracked"), "task pending\n");
  git(originalCwd, "init", "--initial-branch=unrelated");
  assert.equal(git(originalCwd, "rev-parse", "--show-toplevel"), originalCwd);
  const admin = git(data.root, "rev-parse", "--absolute-git-dir");
  const before = snapshot(source), taskStatus = git(data.root, "status", "--porcelain=v1"),
    index = readFileSync(join(admin, "index")), metadata = readFileSync(join(admin, "workflow-task.json")),
    worktrees = git(source, "worktree", "list", "--porcelain"), branches = git(source, "branch"), count = h.sessions.length;
  if (via === "helper") {
    const result = await h.call({}, undefined, "workflow_exit");
    assert.equal(result.terminate, true);
  } else await h.command("workflow-exit");
  assert.equal(h.sessions.length, count, "refuse replacement before loading the unrelated repository");
  assert.equal(h.current, active); assert.deepEqual(taskState(h), data);
  assert.match(notifications(h), /Workflow return failed:.*Original workflow directory\/repository mismatch/);
  assert.doesNotMatch(notifications(h), /Returned to /);
  assert.deepEqual(snapshot(source), before);
  assert.equal(git(data.root, "status", "--porcelain=v1"), taskStatus);
  assert.deepEqual(readFileSync(join(admin, "index")), index);
  assert.deepEqual(readFileSync(join(admin, "workflow-task.json")), metadata);
  assert.equal(readFileSync(join(data.root, "tracked"), "utf8"), "task unstaged\n");
  assert.equal(readFileSync(join(data.root, "untracked"), "utf8"), "task pending\n");
  assert.equal(git(source, "worktree", "list", "--porcelain"), worktrees);
  assert.equal(git(source, "branch"), branches);
});

test("all phases expose explicit return guidance without publication/completion authority", async (t) => {
  const h = await harness(); t.after(() => h.close());
  for (const mode of modes) {
    await h.command(mode, "plan.md");
    assert.ok(h.current.active.includes("workflow_exit"));
    assert.match(h.current.prompts[0].workflow, /When the user explicitly asks to return\/exit without publishing, call workflow_exit once/);
    assert.match(h.current.prompts[0].workflow, /quoted examples or a bare exit never authorize publication/);
    assert.match(h.current.prompts[0].workflow, /it marks nothing approved or complete/);
    const count = h.sessions.length;
    await h.task("Explain this quoted example, do not act: I'm done committing; /workflow-exit");
    assert.equal(h.sessions.length, count, "no global phrase interceptor");
    assert.equal(state(h).mode, mode);
  }
  await h.command("workflow"); assert.match(h.current.notices.at(-1).content, /\/workflow-exit returns to the original launch cwd/);
});

// Synthetic URL transport only: the extension neither publishes nor verifies publication.
for (const failure of [undefined, "queue", "drop", "switch", "cancel", "wrong-cwd"]) test(`Finalize published-URL return: ${failure ?? "success"}`, async (t) => {
  const source = freshSource("publication-return"), h = await harness({ directory: source }); t.after(() => h.close());
  await h.command("plan", "task"); const data = taskState(h);
  await h.call({ mode: "finalize", input: "/exact/plan.md", notes: "Transport fixture; no real publication." });
  writeFileSync(join(data.root, "tracked"), "retained task work\n");
  const before = snapshot(source), taskStatus = git(data.root, "status", "--porcelain=v1"), head = git(data.root, "rev-parse", "HEAD");
  const url = "https://github.example.invalid/owner/repo/pull/42";
  const definition = h.current.extension.tools.get("workflow_exit").definition;
  assert.deepEqual(validateToolArguments(definition, { name: definition.name, arguments: { publicationUrl: url } }), { publicationUrl: url });
  const count = h.sessions.length; h.setFailure(failure);
  const result = await h.call({ publicationUrl: url }, undefined, "workflow_exit");
  assert.ok(result.content[0].text.includes(url));
  assert.equal(result.isError, failure === "queue" ? true : undefined);
  assert.equal(h.sessions.length, count + (!failure || failure === "wrong-cwd" ? 1 : 0));
  if (!failure) {
    assert.equal(result.terminate, true); assert.equal(h.current.ctx.cwd, source);
    assert.equal(state(h), undefined); assert.deepEqual(h.current.active, normalTools);
    assert.equal(h.current.sent.length, 0); assert.equal(h.current.prompts.length, 0);
    const notice = SessionManager.open(h.current.entryFile).getEntries().find((entry) => entry.customType === "workflow-notice").content;
    assert.ok(notice.includes(url)); assert.match(notice, /Pending files remain there/);
    assert.match(notice, /CI and merge remain yours/); assert.doesNotMatch(notice, /Nothing was published/);
  } else if (!["queue", "drop"].includes(failure)) {
    assert.ok(notifications(h).includes(url), "failure recovery retains already reported publication URL");
    assert.match(notifications(h), /Retained task workspace:/);
    assert.match(notifications(h), /Return (?:validation )?failed|Workflow return failed/);
  }
  assert.deepEqual(snapshot(source), before);
  assert.equal(git(data.root, "status", "--porcelain=v1"), taskStatus);
  assert.equal(git(data.root, "rev-parse", "HEAD"), head);
  assert.equal(existsSync(join(git(data.root, "rev-parse", "--absolute-git-dir"), "workflow-task.json")), true);
});

test("published return context is Finalize-only and rejects malformed or credential-bearing URLs without dispatch", async (t) => {
  const h = await harness(); t.after(() => h.close());
  const url = "https://github.example.invalid/owner/repo/pull/42";
  for (const mode of ["plan", "build", "review", "ui"]) {
    await h.command(mode, "plan.md"); const count = h.sessions.length;
    await assert.rejects(() => h.call({ publicationUrl: url }, undefined, "workflow_exit"), /Finalize-only/);
    await h.command("workflow-exit", JSON.stringify(url)); assert.equal(h.sessions.length, count);
    assert.match(notifications(h), /Finalize-only/);
  }
  await h.command("finalize", "plan.md"); const count = h.sessions.length;
  for (const publicationUrl of [null, 12, "not a URL", "http://github.example.invalid/o/r/pull/1", "https://user:secret@github.example.invalid/o/r/pull/1", `${url}?token=secret`, `${url}#secret`, "https://github.example.invalid/o/r/issues/1", "https://github.example.invalid/o/r/pull/0"]) {
    await assert.rejects(() => h.call({ publicationUrl }, undefined, "workflow_exit"));
    assert.equal(h.sessions.length, count);
  }
  await h.command("workflow-exit", "invalid JSON"); assert.equal(h.sessions.length, count);
  await assert.rejects(() => h.call({ publicationUrl: url }, AbortSignal.abort(), "workflow_exit"), /cancelled/);
  await h.command("workflow-exit");
  const notice = SessionManager.open(h.current.entryFile).getEntries().find((entry) => entry.customType === "workflow-notice").content;
  assert.match(notice, /Nothing was published/); assert.doesNotMatch(notice, /Published PR:/);
});

function freshSource(label) { return repository(join(temp, `${label}-${randomUUID()}`)); }
function notifications(h) { return h.sessions.flatMap((s) => [...s.notifications.map(({ text }) => text), ...s.notices.map(({ content }) => content)]).join("\n"); }
function snapshot(directory) {
  return { status: git(directory, "status", "--porcelain=v1", "--untracked-files=all"), branch: git(directory, "branch", "--show-current"), head: git(directory, "rev-parse", "HEAD"), index: readFileSync(join(directory, ".git", "index")), tracked: readFileSync(join(directory, "tracked"), "utf8") };
}

test("Plan creates a real isolated worktree at exact launching HEAD and persists an entry session before switching", async (t) => {
  const source = freshSource("source with spaces $()"), original = snapshot(source);
  const h = await harness({ directory: join(source, "sub dir") }); t.after(() => h.close());
  h.current.ctx.model = { provider: "test-provider", id: "user-chosen-model" };
  h.current.ctx.thinkingLevel = "high";
  await h.command("plan", 'Fix "quotes"; $(touch NEVER-RUN)\nwith \\paths');
  assert.equal(h.sessions.length, 2);
  const data = taskState(h);
  assert.equal(h.current.ctx.cwd, join(data.root, "sub dir"));
  assert.notEqual(data.root, source);
  assert.equal(data.originalCwd, join(source, "sub dir"));
  assert.equal(data.sourceRoot, source);
  assert.equal(data.commit, original.head);
  assert.equal(git(data.root, "rev-parse", "HEAD"), original.head);
  assert.equal(git(data.root, "branch", "--show-current"), data.branch);
  assert.equal(existsSync(join(data.root, "workflow-task.json")), false);
  const admin = git(data.root, "rev-parse", "--absolute-git-dir");
  assert.deepEqual(JSON.parse(readFileSync(join(admin, "workflow-task.json"), "utf8")), data);
  const entry = SessionManager.open(h.current.entryFile);
  assert.equal(entry.getCwd(), h.current.ctx.cwd);
  assert.equal(entry.getSessionDir(), join(agentDir, "custom-sessions"));
  assert.equal(entry.getEntries().some((e) => e.type === "message"), false, "no fabricated conversation is needed to persist entry");
  assert.ok(entry.getEntries().some((e) => e.type === "custom_message" && e.customType === "workflow-notice" && e.display));
  assert.ok(entry.getEntries().some((e) => e.type === "model_change" && e.modelId === "user-chosen-model"));
  assert.ok(entry.getEntries().some((e) => e.type === "thinking_level_change" && e.thinkingLevel === "high"));
  assert.deepEqual(snapshot(source), original);
  assert.equal(existsSync(join(source, "NEVER-RUN")), false);
  assert.match(h.current.prompts[0].workflow, /Task workspace:/);
  assert.match(notifications(h), new RegExp(original.head));
});

test("dirty-source approval leaves staged, unstaged, and untracked files/index untouched and absent in the task", async (t) => {
  const source = freshSource("dirty");
  writeFileSync(join(source, "tracked"), "staged change\n"); git(source, "add", "tracked");
  writeFileSync(join(source, "tracked"), "unstaged change\n"); writeFileSync(join(source, "untracked"), "private pending file");
  const original = snapshot(source);
  const h = await harness({ directory: source, select: (_question, options) => options[0] }); t.after(() => h.close());
  await h.command("plan", "task");
  assert.equal(h.sessions[0].selections.length, 1);
  assert.equal(readFileSync(join(taskState(h).root, "tracked"), "utf8"), "committed\n");
  assert.equal(existsSync(join(taskState(h).root, "untracked")), false);
  assert.deepEqual(snapshot(source), original);
});

for (const cancel of ["Cancel", undefined, "unexpected", "no-ui", "abort"]) test(`dirty-source ${cancel ?? "Escape"} never creates a task or starts a phase`, async (t) => {
  const source = freshSource("cancel"); writeFileSync(join(source, "untracked"), "pending");
  const before = git(source, "worktree", "list", "--porcelain"), branches = git(source, "branch");
  const controller = new AbortController();
  const h = await harness({ directory: source, mode: cancel === "no-ui" ? "print" : "tui", select: () => { if (cancel === "abort") controller.abort(); return cancel === "abort" ? "Proceed from committed files only" : cancel; } }); t.after(() => h.close());
  h.current.ctx.signal = controller.signal;
  await h.command("plan", "task");
  assert.equal(h.sessions.length, 1);
  assert.equal(h.current.sent.length, 0);
  assert.equal(state(h), undefined);
  assert.equal(git(source, "worktree", "list", "--porcelain"), before);
  assert.equal(git(source, "branch"), branches);
  assert.match(notifications(h), /cancelled|aborted|No task created/);
});

test("concurrent tasks do not collide; replanning, handoffs, fresh instances, and resume reuse one association", async (t) => {
  const source = freshSource("parallel");
  const a = await harness({ directory: source }), b = await harness({ directory: source });
  t.after(() => { a.close(); b.close(); });
  await Promise.all([a.command("plan", "same task text"), b.command("plan", "same task text")]);
  const first = taskState(a), second = taskState(b);
  assert.notEqual(first.id, second.id); assert.notEqual(first.root, second.root); assert.notEqual(first.branch, second.branch);
  assert.equal(first.projectKey, second.projectKey); assert.equal(first.repository, second.repository);
  writeFileSync(join(first.root, "pending-task-file"), "pending");
  const worktrees = git(source, "worktree", "list", "--porcelain");
  for (const mode of modes) {
    await a.call({ mode, input: "/absolute/original-plan.md", notes: "WT-1; explicit loop authority" });
    assert.deepEqual(taskState(a), first); assert.equal(a.current.ctx.cwd, first.root);
  }
  const fresh = await harness({ directory: first.root }); t.after(() => fresh.close());
  assert.equal(fresh.current.sent.length, 0); assert.equal(state(fresh), undefined);
  await fresh.command("build", "original-plan.md");
  assert.deepEqual(taskState(fresh), first);
  const records = structuredClone(fresh.current.records);
  await fresh.resume(records);
  assert.equal(fresh.current.sent.length, 0); assert.deepEqual(taskState(fresh), first);
  assert.equal(git(source, "worktree", "list", "--porcelain"), worktrees);
  assert.equal(readFileSync(join(first.root, "pending-task-file"), "utf8"), "pending");
});

for (const mode of modes.filter((mode) => mode !== "plan")) test(`unmanaged /${mode} pauses without creating or switching a workspace`, async (t) => {
  const source = freshSource("unmanaged"), before = snapshot(source);
  const h = await harness({ directory: source }); t.after(() => h.close());
  await h.command(mode, "existing-plan.md");
  assert.equal(h.sessions.length, 1); assert.equal(h.current.sent.length, 0);
  assert.match(notifications(h), /No managed task worktree.*Legacy tasks need explicit user direction/);
  assert.deepEqual(snapshot(source), before);
});

test("detached source HEAD works, but unborn/non-Git/missing-Git and ephemeral entry stop safely", async (t) => {
  const source = freshSource("detached"); git(source, "checkout", "--detach");
  const h = await harness({ directory: source }); t.after(() => h.close());
  await h.command("plan", "detached task"); assert.ok(taskState(h)); assert.match(notifications(h), /detached HEAD/);
  const unborn = join(temp, "unborn"); mkdirSync(unborn); git(unborn, "init", "--initial-branch=main");
  const nongit = join(temp, "not-git"); mkdirSync(nongit);
  const clean = freshSource("ephemeral");
  for (const [directory, persistent] of [[unborn, true], [nongit, true], [clean, false]]) {
    const stopped = await harness({ directory, persistent }); t.after(() => stopped.close());
    await stopped.command("plan", "task"); assert.equal(stopped.sessions.length, 1); assert.equal(stopped.current.sent.length, 0);
    assert.match(notifications(stopped), /could not start/);
  }
  const missing = await harness({ directory: clean }); t.after(() => missing.close());
  const path = process.env.PATH;
  try { process.env.PATH = join(temp, "no-executables"); await missing.command("plan", "task"); }
  finally { process.env.PATH = path; }
  assert.equal(missing.sessions.length, 1); assert.match(notifications(missing), /ENOENT/);
  assert.equal(git(clean, "worktree", "list", "--porcelain").split("worktree ").length, 2);
});

test("missing committed launch subdirectory retains identified resources and asks instead of switching to root", async (t) => {
  const source = freshSource("missing-subdir"), sub = join(source, "ignored-subdir"); mkdirSync(sub);
  const h = await harness({ directory: sub }); t.after(() => h.close());
  await h.command("plan", "task");
  assert.equal(h.sessions.length, 1); assert.equal(h.current.sent.length, 0);
  assert.match(notifications(h), /Launch subdirectory is absent.*Ask the user/s);
  assert.match(notifications(h), /retained branch.*No rollback performed/s);
  assert.equal(git(source, "worktree", "list", "--porcelain").split("worktree ").length, 3);
});

for (const failure of ["switch", "cancel", "prompt", "wrong-cwd"]) test(`initial ${failure} failure preserves resources and never prompts in the source`, async (t) => {
  const source = freshSource("entry-failure"), before = snapshot(source);
  const h = await harness({ directory: source, failure }); t.after(() => h.close());
  await h.command("plan", "task");
  assert.equal(h.sessions[0].sent.length, 0);
  assert.equal(h.sessions.flatMap((s) => s.prompts).length, 0);
  assert.match(notifications(h), /Retained workspace:/);
  assert.match(notifications(h), /Entry session:/);
  assert.deepEqual(snapshot(source), before);
  assert.equal(git(source, "worktree", "list", "--porcelain").split("worktree ").length, 3);
});

test("invalid metadata, branch/repository/session mismatches, and legacy state pause without dispatch", async (t) => {
  for (const damage of ["json", "branch", "repository", "session", "missing", "legacy"]) {
    const source = freshSource("invalid");
    const h = await harness({ directory: source }); t.after(() => h.close());
    await h.command("plan", "task");
    const data = taskState(h), records = structuredClone(h.current.records);
    const metadata = join(git(data.root, "rev-parse", "--absolute-git-dir"), "workflow-task.json");
    if (damage === "json") writeFileSync(metadata, "not-json");
    if (damage === "branch") git(data.root, "checkout", "-b", "unexpected-branch");
    if (damage === "repository") writeFileSync(metadata, JSON.stringify({ ...data, repository: source }));
    if (damage === "session") records.find((e) => e.customType === "workflow-phase").data.task.id = randomUUID();
    if (damage === "missing") rmSync(metadata);
    if (damage === "legacy") delete records.find((e) => e.customType === "workflow-phase").data.task;
    await h.resume(records);
    assert.equal(h.current.sent.length, 0);
    await h.command("workflow");
    assert.match(h.current.notices.at(-1).content, /Workflow paused:/);
    assert.doesNotMatch(h.current.notices.at(-1).content, /Default plan:|Plannotator code-review target:/);
    const prompt = (await h.task()).workflow;
    assert.match(prompt, /Workflow paused:/);
    assert.match(prompt, /Do not execute phase work or mutate Git/);
    const count = h.sessions.length;
    if (damage !== "legacy") { await h.command("build", "plan.md"); assert.equal(h.sessions.length, count); }
  }
});

const serverTool = "workflow_ui_server";
test("owned server tool is UI-only, validates task/cwd, and supplied user URLs take no ownership", async (t) => {
  const h = await harness(); t.after(() => h.close());
  for (const mode of [undefined, "plan", "build", "review", "finalize"]) {
    if (mode) await h.command(mode, "original-plan.md");
    assert.ok(!h.current.active.includes(serverTool));
    await assert.rejects(() => h.call({ action: "status" }, undefined, serverTool), /UI-only/);
  }
  await h.command("ui", "original-plan.md");
  assert.ok(h.current.active.includes(serverTool));
  await h.task("Use my already-running http://localhost:49880/route?x=1#part");
  const status = await h.call({ action: "status" }, undefined, serverTool);
  assert.equal(status.details.owned, false); assert.deepEqual(status.details.urls, []);
  const def = h.current.extension.tools.get(serverTool).definition;
  assert.deepEqual(Object.keys(def.parameters.properties).sort(), ["action", "args", "command", "cwd"]);
  await assert.rejects(() => h.call({ action: "start", command: process.execPath, cwd: temp }, undefined, serverTool), /inside the task/);
  await assert.rejects(() => h.call({ action: "start", command: process.execPath }, undefined, serverTool), /absolute application cwd/);
  await assert.rejects(() => h.call({ action: "start", command: process.execPath, cwd }, AbortSignal.abort(), serverTool), /abort/i);
  assert.equal((await h.call({ action: "stop" }, undefined, serverTool)).details.owned, false);
});

for (const departure of ["handoff", "publication-return", "exit", "tree", "reload", "shutdown", "cancelled-transition"]) test(`owned UI server cleanup on ${departure}`, async (t) => {
  const h = await harness(); t.after(() => h.close());
  await h.command("ui", "original-plan.md");
  const file = join(temp, `owned-ui-${randomUUID()}.json`), application = join(cwd, "sub dir");
  const script = `require('node:fs').writeFileSync(${JSON.stringify(file)}, JSON.stringify({pid:process.pid,cwd:process.cwd()})); console.log('http://localhost:49881/actual?x=1#part'); setInterval(()=>{},1000);`;
  const result = await h.call({ action: "start", command: process.execPath, args: ["-e", script], cwd: application }, undefined, serverTool);
  assert.equal(result.details.url, "http://localhost:49881/actual?x=1#part");
  const child = JSON.parse(readFileSync(file, "utf8"));
  assert.equal(child.cwd, realpathSync(application));
  process.kill(child.pid, 0);
  await assert.rejects(() => h.call({ action: "start", command: process.execPath, args: ["-e", script], cwd: application }, undefined, serverTool), /already owned/);
  if (departure === "handoff") await h.call({ mode: "finalize", input: "original-plan.md" });
  if (departure === "publication-return") {
    await h.call({ mode: "finalize", input: "original-plan.md", notes: "Synthetic transport only; no authority to publish this fixture." });
    assert.ok(!h.current.active.includes(serverTool));
    await h.call({ publicationUrl: "https://github.example.invalid/owner/repo/pull/12" }, undefined, "workflow_exit");
    const notice = SessionManager.open(h.current.entryFile).getEntries().find((entry) => entry.customType === "workflow-notice").content;
    assert.match(notice, /Published PR: https:\/\/github.example.invalid\/owner\/repo\/pull\/12/);
    assert.equal(h.current.sent.length, 0); assert.equal(state(h), undefined);
  }
  if (departure === "exit") await h.call({}, undefined, "workflow_exit");
  if (departure === "tree") await h.tree([]);
  if (departure === "reload") await h.resume(structuredClone(h.current.records));
  if (departure === "shutdown") await h.shutdown();
  if (departure === "cancelled-transition") { h.setFailure("cancel"); await h.command("build", "original-plan.md"); assert.equal(state(h).mode, "ui"); }
  const until = Date.now() + 3000;
  while (true) {
    try { process.kill(child.pid, 0); }
    catch (error) { assert.equal(error.code, "ESRCH"); break; }
    assert.ok(Date.now() < until, "owned synthetic child must stop");
    await delay(25);
  }
  if (state(h)?.mode === "ui") assert.equal((await h.call({ action: "status" }, undefined, serverTool)).details.owned, false);
  else assert.ok(!h.current.active.includes(serverTool));
});

test("UI prompt retains inspected-command authority, live gate, cleanup and manual fallback", async (t) => {
  const h = await harness(); t.after(() => h.close());
  await h.command("ui", "original-plan.md");
  const prompt = h.current.prompts[0].workflow;
  for (const contract of [
    /Inspect the project's existing dev command and all scripts it invokes/,
    /Ask if command, authority, prerequisites or data effects are unclear/,
    /without starting, adopting or stopping that server/,
    /With one usable URL, use it without a routine URL question/,
    /multiple\/no usable URLs/i,
    /Keep the owned server alive while Plannotator waits/,
    /Before any phase handoff or requested return, call workflow_ui_server stop/,
    /plannotator annotate on the URL with gate: true, then end the turn/,
    /cannot force --app/,
    /Do not silently substitute a static page/,
    /plain browser close may send no message/,
    /same-user agents\/configured credentials/,
    /never claim cleanup happened when it failed/,
  ]) assert.match(prompt, contract);
});

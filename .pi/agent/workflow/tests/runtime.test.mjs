import assert from "node:assert/strict";
import { test } from "node:test";
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const install = join(homedir(), ".pi/agent/install");
const piRoot = process.env.PI_TEST_PACKAGE_ROOT ?? join(install, "releases", readFileSync(join(install, "current-version"), "utf8").trim(), "node_modules/@earendil-works/pi-coding-agent");
const sdk = await import(pathToFileURL(join(piRoot, "dist/index.js")));
const { InMemoryCredentialStore } = await import(pathToFileURL(resolve(piRoot, "../pi-ai/dist/index.js")));
const extension = fileURLToPath(new URL("../../extensions/workflow-modes.ts", import.meta.url));

// Public Pi runtime integration, no model requests, browser, interactive host, or external services.
for (const failure of [undefined, "selection-unavailable", "switch-create", "switch-rebind", "new-create", "new-rebind", "exit-create", "exit-rebind"]) test(`public runtime workspace entry: ${failure ?? "cwd, resources, tools, and selected model"}`, async (t) => {
  const temp = realpathSync(mkdtempSync(join(tmpdir(), "pi-workflow-runtime-")));
  const previous = { HOME: process.env.HOME, PI_CODING_AGENT_DIR: process.env.PI_CODING_AGENT_DIR };
  process.env.HOME = temp;
  const agentDir = join(temp, "agent"), source = join(temp, "source");
  process.env.PI_CODING_AGENT_DIR = agentDir;
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    rmSync(temp, { recursive: true, force: true });
  });
  mkdirSync(join(source, ".pi", "extensions"), { recursive: true });
  mkdirSync(join(agentDir, "workflow"), { recursive: true });
  for (const name of ["common", "plan", "build"]) cpSync(new URL(`../${name}.md`, import.meta.url), join(agentDir, "workflow", `${name}.md`));
  const git = (...args) => execFileSync("git", ["-C", source, ...args], { encoding: "utf8", env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" } });
  git("init", "--initial-branch=main"); git("config", "user.name", "Runtime Test"); git("config", "user.email", "runtime@example.invalid");
  writeFileSync(join(source, "AGENTS.md"), "COMMITTED TARGET INSTRUCTIONS\n");
  writeFileSync(join(source, "tracked"), "committed target content\n");
  writeFileSync(join(source, ".pi", "extensions", "probe.ts"), `export default function (pi) {
    pi.registerTool({ name: "cwd_probe", label: "cwd", description: "test cwd", parameters: { type: "object", properties: {} },
      async execute(_id, _args, _signal, _update, ctx) { return { content: [{ type: "text", text: ctx.cwd }], details: undefined }; }
    });
  }\n`);
  git("add", "."); git("-c", "commit.gpgsign=false", "commit", "-m", "fixture");
  // Ignored dependencies are not needed. Do not copy dirty instructions into the new checkout.
  writeFileSync(join(source, "AGENTS.md"), "SOURCE PENDING INSTRUCTIONS\n");
  const captured = [], notifications = [];
  let replacementFinished;
  const replace = async (operation) => {
    try { return await operation(); }
    finally { replacementFinished?.(); }
  };
  const call = async (session, name, args) => {
    const done = new Promise((resolve) => { replacementFinished = resolve; });
    await session.agent.state.tools.find((tool) => tool.name === name).execute("transport", args);
    await done;
  };
  const credentials = new InMemoryCredentialStore();
  let failReplacement = false;
  const createRuntime = async ({ cwd, sessionManager, sessionStartEvent }) => {
    if (failReplacement && failure?.endsWith("create")) throw new Error("TARGET_REBUILD_FAILED");
    const modelRuntime = await sdk.ModelRuntime.create({ credentials, modelsPath: join(agentDir, "models.json"), refreshOnCreate: false });
    await modelRuntime.setRuntimeApiKey("anthropic", "synthetic-test-key");
    const services = await sdk.createAgentSessionServices({ cwd, agentDir, modelRuntime,
      settingsManager: sdk.SettingsManager.inMemory({ defaultProjectTrust: "always", defaultTools: ["read", "cwd_probe"], defaultProvider: "anthropic", defaultModel: "claude-sonnet-4-5", defaultThinkingLevel: "low" }),
      resourceLoaderOptions: { additionalExtensionPaths: [extension], noSkills: true, noThemes: true, noPromptTemplates: true },
    });
    return { ...(await sdk.createAgentSessionFromServices({ services, sessionManager, sessionStartEvent,
      ...(failure === "selection-unavailable" && cwd !== source ? { model: modelRuntime.getModel("anthropic", "claude-sonnet-4-5") } : {}),
      excludeTools: ["bash", "edit", "write"] })), services, diagnostics: services.diagnostics };
  };
  const runtime = await sdk.createAgentSessionRuntime(createRuntime, { cwd: source, agentDir, sessionManager: sdk.SessionManager.create(source, join(temp, "custom sessions")) });
  t.after(() => runtime.dispose());
  const ui = {
    ...runtime.session.createReplacedSessionContext().ui,
    theme: { colors: { accent: { kind: "rgb", r: 100, g: 100, b: 100 } }, style: (text) => text },
    notify: (text) => notifications.push(text), setStatus: () => {},
    select: async (_question, options) => options[0],
  };
  const withCapture = (options) => ({ ...options, withSession: async (ctx) => {
    await options?.withSession?.({ ...ctx,
      sendUserMessage: async (content, options) => captured.push({ cwd: ctx.cwd, content, options, model: ctx.model?.id, thinking: ctx.thinkingLevel }),
      sendMessage: async (message, options) => { assert.equal(options.triggerTurn, false); notifications.push(message.content); },
    });
  } });
  const bind = async (session) => {
    if (failReplacement && failure?.endsWith("rebind")) throw new Error("TARGET_REBIND_FAILED");
    return session.bindExtensions({ uiContext: ui, commandContextActions: {
    waitForIdle: () => session.waitForIdle(),
    newSession: (options) => replace(() => runtime.newSession(withCapture(options))),
    switchSession: (file, options) => replace(() => runtime.switchSession(file, withCapture(options))),
    } });
  };
  runtime.setRebindSession(bind); await bind(runtime.session);
  await runtime.session.setModel(runtime.services.modelRuntime.getModel("anthropic", "claude-opus-4-5"));
  runtime.session.setThinkingLevel("high");
  if (failure?.startsWith("switch")) failReplacement = true;
  const oldSession = runtime.session, oldContext = oldSession.createReplacedSessionContext();
  assert.match(oldSession.systemPrompt, /SOURCE PENDING INSTRUCTIONS/);
  await oldSession.prompt("/work A runtime task");
  if (failure?.startsWith("new") || failure?.startsWith("exit")) {
    assert.equal(captured.length, 1, notifications.join("\n"));
    captured.length = 0;
    failReplacement = true;
    const taskSession = runtime.session;
    await call(taskSession, failure.startsWith("exit") ? "workflow_exit" : "workflow_handoff", failure.startsWith("exit") ? {} : { mode: "build", input: "/original-plan.md" });
    assert.throws(() => taskSession.createReplacedSessionContext().getSystemPromptOptions(), /stale|disposed/);
  }
  if (failure === "selection-unavailable") {
    assert.equal(captured.length, 0);
    assert.match(notifications.join("\n"), /Selected model\/thinking could not be restored/);
    assert.match(notifications.join("\n"), /Retained workspace:/);
    return;
  }
  if (failure) {
    const output = notifications.join("\n");
    assert.equal(captured.length, 0, "failed replacement must not dispatch phase work");
    assert.match(output, failure.endsWith("create") ? /TARGET_REBUILD_FAILED/ : /TARGET_REBIND_FAILED/);
    assert.match(output, failure.startsWith("exit") ? /Retained task workspace:/ : /Retained workspace:/);
    assert.match(output, /relaunch Pi/i);
    assert.doesNotMatch(output, /stale/);
    assert.throws(() => oldContext.getSystemPromptOptions(), /stale/);
    return;
  }
  assert.notEqual(runtime.session, oldSession);
  assert.notEqual(runtime.cwd, source);
  assert.equal(captured.length, 1, notifications.join("\n"));
  assert.equal(captured[0].cwd, runtime.cwd);
  assert.match(captured[0].content, /Begin plan now/);
  assert.equal(captured[0].model, "claude-opus-4-5");
  assert.equal(captured[0].thinking, "high");
  assert.equal(runtime.session.model.id, "claude-opus-4-5");
  assert.equal(runtime.session.thinkingLevel, "high");
  const entryNotice = runtime.session.messages.find((message) => message.role === "custom" && message.customType === "workflow-notice");
  assert.match(entryNotice.content, /Task workspace:/);
  assert.ok(!runtime.session.messages.some((message) => message.role === "assistant"));
  assert.match(runtime.session.systemPrompt, /COMMITTED TARGET INSTRUCTIONS/);
  assert.doesNotMatch(runtime.session.systemPrompt, /SOURCE PENDING INSTRUCTIONS/);
  const read = await runtime.session.agent.state.tools.find((tool) => tool.name === "read").execute("read-check", { path: "tracked" });
  assert.notEqual(read.isError, true); assert.equal(read.content[0].text, "committed target content\n");
  const probe = await runtime.session.agent.state.tools.find((tool) => tool.name === "cwd_probe").execute("cwd-check", {});
  assert.notEqual(probe.isError, true); assert.equal(probe.content[0].text, runtime.cwd);
  assert.ok(!runtime.session.getActiveToolNames().includes("bash"));
  assert.throws(() => oldContext.getSystemPromptOptions(), /stale/);
  assert.equal(readFileSync(join(source, "AGENTS.md"), "utf8"), "SOURCE PENDING INSTRUCTIONS\n");
  assert.equal(resolve(runtime.session.sessionManager.getSessionDir()), join(temp, "custom sessions"));
  const taskRoot = runtime.cwd, taskSession = runtime.session;
  captured.length = 0;
  await call(taskSession, "workflow_exit", {});
  assert.equal(runtime.cwd, source);
  assert.notEqual(runtime.session, taskSession);
  assert.equal(captured.length, 0, "return starts no model turn or phase dispatch");
  assert.equal(runtime.session.model.id, "claude-opus-4-5");
  assert.equal(runtime.session.thinkingLevel, "high");
  assert.ok(!runtime.session.sessionManager.getBranch().some((entry) => entry.customType === "workflow-phase"));
  assert.ok(!runtime.session.getActiveToolNames().some((name) => name.startsWith("workflow_")));
  assert.ok(!runtime.session.getActiveToolNames().includes("bash"), "return preserves host tool exclusions");
  assert.equal(resolve(runtime.session.sessionManager.getSessionDir()), join(temp, "custom sessions"));
  assert.doesNotMatch(runtime.session.systemPrompt, /# Plan|Phase: plan|When the next phase is known/);
  assert.match(runtime.session.systemPrompt, /SOURCE PENDING INSTRUCTIONS/);
  const sourceRead = await runtime.session.agent.state.tools.find((tool) => tool.name === "read").execute("return-read", { path: "AGENTS.md" });
  assert.equal(sourceRead.content[0].text, "SOURCE PENDING INSTRUCTIONS\n");
  const returnNotice = runtime.session.messages.find((message) => message.role === "custom" && message.customType === "workflow-notice");
  assert.ok(returnNotice.content.includes(`Task retained at ${taskRoot}`));
  assert.match(returnNotice.content, /Nothing was published, approved, or marked complete/);
});

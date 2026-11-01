import { readFileSync, realpathSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, isAbsolute, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { Type } from "typebox";
import { colorToRgb, rgbColor, type Color } from "@earendil-works/pi-tui";
import { getAgentDir, type ExtensionAPI, type ExtensionCommandContext, type ExtensionContext, type ReplacedSessionContext } from "@earendil-works/pi-coding-agent";
import type { Task } from "./workflow/workspace";

const MODES = ["plan", "build", "review", "ui", "finalize"] as const;
type Mode = typeof MODES[number];
const SKILLS: Record<Mode, string[]> = {
  plan: ["plannotator"],
  build: ["ponytail"],
  review: ["ponytail-review", "plannotator"],
  ui: ["plannotator"],
  finalize: [],
};
type Phase = { mode: Mode; input: string; notes?: string; task?: Task };
const STATE = "workflow-phase";
const TOOL = "workflow_handoff";
const QUESTION = "workflow_question";
const EXIT = "workflow_exit";
const SERVER = "workflow_ui_server";
const TOOLS = [TOOL, EXIT, QUESTION];
const BADGES: Record<Mode, "accent" | "success" | "warning" | "muted"> = {
  plan: "accent",
  build: "warning",
  review: "muted",
  ui: "accent",
  finalize: "success",
};
const BLACK = rgbColor(0, 0, 0), WHITE = rgbColor(255, 255, 255);
function contrastForeground(color: Color) {
  const linear = (value: number) => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  };
  const { r, g, b } = colorToRgb(color);
  const luminance = 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
  return (luminance + 0.05) / 0.05 >= 1.05 / (luminance + 0.05) ? BLACK : WHITE;
}
const recoveryRequest = ({ mode, input }: Phase) => `Ask in chat to start ${mode} with input:\n${input || "not supplied — clarify in chat"}`;

function publicationUrl(value: unknown, mode?: Mode, data?: Task): string | undefined {
  if (value === undefined) return;
  if (data?.kind === "directory") throw new Error("Non-Git tasks cannot accept publication return context.");
  if (mode !== "finalize" || typeof value !== "string") throw new Error("Publication return context is Finalize-only and needs a verified HTTPS PR URL.");
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || !/^\/[^/]+\/[^/]+\/pull\/[1-9]\d*$/.test(url.pathname)) {
    throw new Error("Expected a credential-free HTTPS PR URL without query or fragment.");
  }
  return url.href;
}

function localMerge(value: unknown, mode?: Mode, data?: Task, published?: unknown): string | undefined {
  if (value === undefined) return;
  if (mode !== "finalize" || !data || data.kind === "directory" || published !== undefined || typeof value !== "string" || !value.trim()) {
    throw new Error("Local-merge return requires managed Git Finalize, a base branch and no publicationUrl.");
  }
  return value;
}

function taskGuidance(data: Task) {
  return `Task: ${data.id}\nProject key: ${data.projectKey}\n${data.kind === "directory" ? `Workspace kind: non-Git, in-place\nCanonical directory: ${data.root}\nNo Git baseline or browser file review; edits affect actual files without isolation or rollback.` : `Canonical repository: ${data.repository}\nTask checkout / Plannotator code-review target: ${data.root}`}\nDefault plan: ~/.pi/plans/${data.projectKey}/${data.id}.md\nDefault Plan feedback: ~/.pi/plans/${data.projectKey}/${data.id}-<topic>.md\nDefault Review/UI feedback: ~/.pi/reviews/${data.projectKey}/${data.id}-<topic>-<UTC timestamp>.md\nThese defaults do not replace exact references or per-artifact overrides.${data.kind === "directory" ? " Identity lives only in the session; resume it to continue this task. Never infer identity from an old plan filename." : " Pass the task checkout explicitly as Plannotator code review's target, even when launched in an application subdirectory; never review the source checkout by default."}`;
}

function phase(value: unknown): Phase | undefined {
  const data = value as Phase | undefined;
  return data && MODES.includes(data.mode) && typeof data.input === "string" &&
    (data.notes === undefined || typeof data.notes === "string") ? data : undefined;
}

export default async function workflowModes(pi: ExtensionAPI) {
  // Pi resolves static imports beside the symlink, not its source file.
  const source = dirname(realpathSync(fileURLToPath(import.meta.url)));
  const { UIServer } = await import(join(source, "workflow/ui-server.ts"));
  const { association, entrySession, git, task, workspace } = await import(join(source, "workflow/workspace.ts"));
  const directory = join(getAgentDir(), "workflow");
  const instructions = (mode: Mode) => ["common", mode].map((name) => {
    const path = join(directory, `${name}.md`);
    try { return readFileSync(path, "utf8"); }
    catch (error) { throw new Error(`Required workflow instructions unavailable: ${path}: ${String(error)}`); }
  }).join("\n\n");
  let selected = false, uiSelected = false;
  let pending: { token: string; state?: Phase; published?: string; mergedInto?: string; signal?: AbortSignal } | undefined;
  function dispatch(request: Omit<NonNullable<typeof pending>, "token">) {
    const token = randomUUID();
    pending = { ...request, token };
    try { pi.sendUserMessage(`/work ${token}`, { deliverAs: "followUp", expandPromptTemplates: true }); }
    catch (error) { pending = undefined; throw error; }
  }
  const server = new UIServer();
  const restore = (ctx: ExtensionContext) => {
    const entry = [...ctx.sessionManager.getBranch()].reverse()
      .find((entry) => entry.type === "custom" && entry.customType === STATE);
    return entry?.type === "custom" ? phase(entry.data) : undefined;
  };

  async function sync(ctx: ExtensionContext, state: Phase | undefined) {
    if (state?.mode !== "ui") await server.stop();
    const status = state
      ? ctx.ui.theme.style(` ${state.mode} `, {
          fg: contrastForeground(ctx.ui.theme.colors[BADGES[state.mode]]),
          bg: ctx.ui.theme.colors[BADGES[state.mode]],
        })
      : ctx.ui.theme.style(" auto ", { fg: "text", bg: "selectedBg" });
    ctx.ui.setStatus("workflow", status);
    if (Boolean(state) !== selected) {
      const others = pi.getActiveTools().filter((name) => !TOOLS.includes(name));
      pi.setActiveTools(state ? [...others, ...TOOLS] : others);
    }
    selected = Boolean(state);
    if ((state?.mode === "ui") !== uiSelected) {
      const others = pi.getActiveTools().filter((name) => name !== SERVER);
      pi.setActiveTools(state?.mode === "ui" ? [...others, SERVER] : others);
    }
    uiSelected = state?.mode === "ui";
  }

  async function start(state: Phase, ctx: ExtensionCommandContext) {
    const manual = recoveryRequest(state);
    // The UI channel survives replacement; the context getter does not.
    const notify = ctx.ui.notify.bind(ctx.ui);
    const selection = { model: ctx.model && { provider: ctx.model.provider, id: ctx.model.id }, thinking: ctx.thinkingLevel };
    const sourceCwd = ctx.cwd;
    let recovery = `Current workspace: ${sourceCwd}`;
    const fallback = (error: unknown) => `Workflow could not start ${state.mode}: ${String(error)}\n${recovery}\nNo fallback work was started in the source checkout. If replacement failed, relaunch Pi in the retained task workspace; otherwise request a retry in chat there. From fresh ordinary Pi, /work enters Plan first; then request the desired phase in chat, or resume the workflow session.\n${manual}${state.notes ? `\nHandoff notes:\n${state.notes}` : ""}`;
    try {
      await ctx.waitForIdle();
      ctx.signal?.throwIfAborted();
      await server.stop();
      instructions(state.mode);
      const current = restore(ctx);
      if (current && !current.task) throw new Error("Legacy/unassociated workflow session; ask for recovery direction, not automatic migration.");
      const target = await workspace(ctx, state.mode, current?.task);
      state = { ...state, task: target.task };
      recovery = `Task ${target.task.id}: ${target.task.kind === "directory" ? "non-Git, in-place" : target.task.branch}\nRetained workspace: ${target.task.root}\nLaunch cwd: ${target.cwd}`;
      const request = `Begin ${state.mode} now; do not ask for another start confirmation.\n\n${state.input.trim() ? `User input (task/report or plan/reference):\n${state.input}` : "Ask the user for the task or plan/reference you need."}${state.notes ? `\n\nHandoff notes:\n${state.notes}` : ""}`;
      // Session replacement reloads extensions: persist plain data and use only the fresh context afterward.
      const withSession = async (next: ReplacedSessionContext) => {
        try {
          if (next.cwd !== target.cwd) throw new Error(`Destination cwd mismatch: expected ${target.cwd}, received ${next.cwd}`);
          if (target.cwd !== sourceCwd && ((selection.model && (next.model?.provider !== selection.model.provider || next.model?.id !== selection.model.id)) ||
              (selection.thinking !== undefined && next.thinkingLevel !== selection.thinking))) {
            throw new Error("Selected model/thinking could not be restored. Relaunch Pi in the task workspace with your selected model/settings before retrying.");
          }
          await association(next.cwd, target.task, next.signal);
          instructions(state.mode);
          await next.sendUserMessage(request, { expandPromptTemplates: false });
        } catch (error) {
          await next.sendMessage({ customType: "workflow-notice", content: fallback(error), display: true }, { triggerTurn: false });
        }
      };
      // Only initial entry replaces cwd; later phases retain Pi's ordinary fresh-session path.
      let result: { cancelled: boolean };
      if (target.cwd !== ctx.cwd) {
        const file = entrySession(target.cwd, state, ctx);
        recovery += `\nEntry session: ${file}`;
        ctx.ui.notify(`Entering task workspace. If session replacement fails, retain these resources and relaunch Pi there:\n${recovery}`, "info");
        ctx.signal?.throwIfAborted();
        result = await ctx.switchSession(file, { withSession });
      } else {
        result = await ctx.newSession({ setup: async (manager) => { manager.appendCustomEntry(STATE, state); }, withSession });
      }
      if (result.cancelled) notify(fallback("session creation cancelled"), "warning");
    } catch (error) {
      notify(fallback(error), "warning");
    }
  }

  async function verifyLocalMerge(data: Task, base: string, signal?: AbortSignal) {
    if (data.kind === "directory" || data.root === data.sourceRoot || base === data.branch) throw new Error("Local merge needs a separate managed task worktree and base branch.");
    await association(data.root, data, signal);
    await git(data.sourceRoot, ["check-ref-format", "--branch", base], signal);
    if (await git(data.sourceRoot, ["branch", "--show-current"], signal) !== base) throw new Error("Source checkout is not on the selected local base branch.");
    const head = await git(data.root, ["rev-parse", "--verify", "HEAD^{commit}"], signal);
    await git(data.sourceRoot, ["merge-base", "--is-ancestor", head, "HEAD"], signal);
    if (await git(data.sourceRoot, ["status", "--porcelain=v1", "--untracked-files=all"], signal)) throw new Error("Local base checkout has pending files; preserve the worktree and ask for direction.");
    if (await git(data.root, ["status", "--porcelain=v1", "--untracked-files=all", "--ignored=matching"], signal)) {
      throw new Error("Task worktree has pending or ignored files; preserve it and resolve cleanup in chat.");
    }
  }

  async function exit(ctx: ExtensionCommandContext, published?: unknown, mergedInto?: unknown) {
    const notify = ctx.ui.notify.bind(ctx.ui);
    const actualCwd = ctx.cwd;
    const selection = { model: ctx.model && { provider: ctx.model.provider, id: ctx.model.id }, thinking: ctx.thinkingLevel };
    let recovery = `Actual cwd before return: ${actualCwd}`;
    try {
      await ctx.waitForIdle();
      ctx.signal?.throwIfAborted();
      const state = restore(ctx);
      const pr = publicationUrl(published, state?.mode, state?.task);
      const base = localMerge(mergedInto, state?.mode, state?.task, published);
      if (base) recovery += `\nReported local merge into: ${base}; nothing pushed.`;
      if (pr) recovery += `\nReported published PR: ${pr}`;
      if (state && !state.task) throw new Error("Legacy/unassociated workflow session; ask for recovery direction, not automatic migration.");
      const data = await association(actualCwd, state?.task, ctx.signal);
      if (!data) throw new Error("No managed task association; ordinary Pi is unchanged.");
      recovery += `\nRetained task workspace: ${data.root}\nOriginal launch cwd: ${data.originalCwd}`;
      if (!ctx.sessionManager.getSessionFile()) throw new Error("Return needs a persistent session; use the manual launch route.");
      await server.stop();
      if (base) await verifyLocalMerge(data, base, ctx.signal);
      const pending = data.kind !== "directory" && await git(data.root, ["status", "--porcelain=v1", "--untracked-files=all"], ctx.signal);
      const notice = `Returned to ${data.originalCwd}. Ordinary Pi; no work started. Task retained at ${data.root}.${pending ? " Pending files remain there." : ""} ${pr ? `Published PR: ${pr}. CI and merge remain yours; no integration or cleanup performed.` : base ? `Local merge into ${base} verified; nothing pushed. Task branch retained; worktree cleanup follows return validation.` : "Nothing was published, approved, or marked complete."}`;
      const file = entrySession(data.originalCwd, undefined, ctx, notice);
      recovery += `\nReturn session: ${file}`;
      ctx.signal?.throwIfAborted();
      const result = await ctx.switchSession(file, { withSession: async (next) => {
        try {
          if (next.cwd !== data.originalCwd) throw new Error(`Destination cwd mismatch: expected ${data.originalCwd}, received ${next.cwd}`);
          await association(data.root, data, next.signal);
          if (restore(next)) throw new Error("Destination still has workflow phase state.");
          if ((selection.model && (next.model?.provider !== selection.model.provider || next.model?.id !== selection.model.id)) ||
              (selection.thinking !== undefined && next.thinkingLevel !== selection.thinking)) {
            throw new Error("Selected model/thinking could not be restored; select your settings before continuing.");
          }
          if (base && data.kind !== "directory") {
            // Never remove the active task checkout before successful session replacement.
            await verifyLocalMerge(data, base, next.signal);
            await git(data.sourceRoot, ["worktree", "remove", "--", data.root], next.signal);
            await next.sendMessage({ customType: "workflow-notice", content: `Removed merged task worktree ${data.root}. Branch ${data.branch} retained. Local base: ${base}; push remains manual.`, display: true }, { triggerTurn: false });
          }
        } catch (error) {
          await next.sendMessage({ customType: "workflow-notice", content: `Return validation failed: ${String(error)}\nActual cwd: ${next.cwd}\n${recovery}\nNo further work started. Inspect the reported task path before resuming; cleanup may have failed or already completed. Relaunch Pi manually in the original directory if needed.`, display: true }, { triggerTurn: false });
        }
      } });
      if (result.cancelled) throw new Error("Session replacement cancelled; return not completed.");
    } catch (error) {
      notify(`Workflow return failed: ${String(error)}\n${recovery}\nIf replacement failed, the active workspace may be unavailable; verify cwd before continuing. Relaunch Pi manually in the original launch directory for ordinary mode, or in the retained task to resume. No Git state or task resources were changed by exit.`, "warning");
    }
  }

  pi.registerCommand("work", {
    description: "Start Plan in a fresh task session: /work [task or report]. Missing input is clarified in chat; phase steering, help and return use chat.",
    handler: async (input, ctx) => {
      const request = pending?.token === input ? pending : undefined;
      // Only an extension-owned, one-shot request is dispatch; all other input is literal Plan text.
      pending = undefined;
      if (!request) return start({ mode: "plan", input }, ctx);
      try {
        await ctx.waitForIdle();
        request.signal?.throwIfAborted();
        if (request.state) await start(request.state, ctx);
        else await exit(ctx, request.published, request.mergedInto);
      } catch (error) {
        ctx.ui.notify(`Workflow dispatch cancelled: ${String(error)}\nActual cwd: ${ctx.cwd}. No replacement requested; retry in chat or resume the workflow session.${request.published ? ` Published PR: ${request.published}.` : ""}`, "warning");
      }
    },
  });
  pi.registerTool({
    name: TOOL, label: "Start the next workflow phase", defaultActive: false, executionMode: "sequential",
    description: "Start a chosen workflow phase in a fresh session. Use once the next step is authorized; use workflow_question for finite unknown choices or chat for free-form clarification. Input is the absolute saved plan/report path (or a new Plan task). Notes carry concise context/guidance, never the previous transcript. Does not save files, review, approve, or enforce phase ordering.",
    parameters: Type.Object({
      mode: Type.Union(MODES.map((mode) => Type.Literal(mode))),
      input: Type.String({ description: "Absolute plan/report reference, or a new task for Plan." }),
      notes: Type.Optional(Type.String({ description: "Short handoff context or approval notes." })),
    }),
    async execute(_id, params, signal, _update, ctx) {
      if ((signal ?? ctx.signal)?.aborted) throw new Error("Workflow handoff cancelled.");
      const state = phase(params);
      if (!state) throw new Error("Expected { mode, input, notes? }.");
      const fallback = `Current workspace: ${ctx.cwd}. If it does not open, retry in chat or resume the workflow session. From fresh ordinary Pi in the retained task, /work enters Plan first.\n${recoveryRequest(state)}${state.notes ? `\nHandoff notes:\n${state.notes}` : ""}`;
      try {
        dispatch({ state: { mode: state.mode, input: state.input, notes: state.notes }, signal: signal && ctx.signal ? AbortSignal.any([signal, ctx.signal]) : signal ?? ctx.signal });
      } catch (error) {
        return { content: [{ type: "text", text: `Handoff request failed: ${String(error)}\n${fallback}` }], details: undefined, isError: true };
      }
      return { content: [{ type: "text", text: `Requested a fresh ${params.mode} session. ${fallback}` }], details: undefined, terminate: true };
    },
  });

  pi.registerTool({
    name: EXIT, label: "Return to ordinary Pi", defaultActive: false,
    exposure: "model-only", executionMode: "sequential",
    description: "Return to fresh ordinary Pi at the original launch cwd on explicit exit or successful Finalize. Never commits, merges or pushes. Only managed Git Finalize may supply publicationUrl (verified PR display context) or mergedInto (local base branch after a reported successful merge), never both. With mergedInto, verifies local ancestry and a task worktree free of pending/ignored files, returns first, then removes only that worktree without force; keeps the task branch. Otherwise preserves all task resources. End the turn after calling. On failure inspect actual cwd and retained resources before recovery; never assume return or cleanup succeeded.",
    parameters: Type.Object({
      publicationUrl: Type.Optional(Type.String({ description: "Managed-Git Finalize-only verified HTTPS PR URL, after reporting successful publication. Display context only." })),
      mergedInto: Type.Optional(Type.String({ description: "Managed-Git Finalize-only local base branch after verified merge. Authorizes non-forced task worktree removal after return; retains branch, never pushes." })),
    }),
    async execute(_id, params, signal, _update, ctx) {
      if (signal?.aborted || ctx.signal?.aborted) throw new Error("Workflow exit cancelled.");
      const state = restore(ctx);
      if (!state) throw new Error("Workflow exit helper is phase-scoped; resume the task's workflow session, or use /work to enter Plan first and request return in chat.");
      const pr = publicationUrl(params.publicationUrl, state.mode, state.task);
      const base = localMerge(params.mergedInto, state.mode, state.task, params.publicationUrl);
      const cwd = ctx.cwd;
      try {
        dispatch({ published: pr, mergedInto: base, signal: signal && ctx.signal ? AbortSignal.any([signal, ctx.signal]) : signal ?? ctx.signal });
      } catch (error) {
        return { content: [{ type: "text", text: `Return request failed: ${String(error)}.${pr ? ` Published PR: ${pr}.` : ""} Current workspace: ${cwd}. Retry in chat or relaunch Pi manually in the original directory; task resources remain intact.` }], details: undefined, isError: true };
      }
      return { content: [{ type: "text", text: `Requested return${pr ? ` after publication: ${pr}` : base ? ` after local merge into ${base}, with worktree cleanup after return` : " without publication"}. Current workspace: ${cwd}. If it does not open, retry in chat or resume the workflow session; task resources remain intact.` }], details: undefined, terminate: true };
    },
  });

  pi.registerTool({
    name: QUESTION, label: "Choose a workflow action", defaultActive: false,
    exposure: "model-only", executionMode: "sequential",
    description: "Ask a finite workflow decision using native selection. Supply context and explicit action labels. Returns a choice, never dispatches a phase. Cancellation means wait for chat without reopening; unavailable UI means ask in chat. Do not re-confirm already-authorized transitions or replace artifact review.",
    parameters: Type.Object({
      question: Type.String({ minLength: 1, pattern: "\\S", description: "Question with context and consequences." }),
      options: Type.Array(Type.String({ minLength: 1, pattern: "\\S" }), { minItems: 2, uniqueItems: true }),
    }),
    async execute(_id, { question, options }, signal, _update, ctx) {
      const abort = signal && ctx.signal ? AbortSignal.any([signal, ctx.signal]) : signal ?? ctx.signal;
      if (abort?.aborted) throw new Error("Workflow question cancelled.");
      if (typeof question !== "string" || !question.trim() || !Array.isArray(options) || options.length < 2 ||
          options.some((option) => typeof option !== "string" || !option.trim()) || new Set(options).size !== options.length) {
        throw new Error("Expected a nonblank question and at least two distinct nonblank options.");
      }
      if (!ctx.hasUI) return {
        content: [{ type: "text", text: `No UI available. Ask in chat; no action is authorized.\n${question}\n${options.map((option) => `- ${option}`).join("\n")}` }],
        details: { status: "unavailable", question, options },
      };
      const choice = await ctx.ui.select(question, options, { signal: abort });
      if (abort?.aborted) throw new Error("Workflow question cancelled.");
      if (choice === undefined) return {
        content: [{ type: "text", text: "Question cancelled; no action is authorized. Wait for chat; do not reopen the picker." }],
        details: { status: "cancelled", question, options }, terminate: true,
      };
      if (!options.includes(choice)) throw new Error("Unexpected workflow choice; no action is authorized.");
      return { content: [{ type: "text", text: `Selected: ${choice}` }], details: { status: "selected", choice } };
    },
  });

  pi.registerTool({
    name: SERVER, label: "UI dev server", defaultActive: false,
    exposure: "model-only", executionMode: "sequential",
    description: "UI-only owned dev-server start/status/stop. Before start inspect the existing command/scripts and establish authority, prerequisites and safe data effects. Pass executable and arguments (no shell expansion or credentials), plus application cwd inside the task. Returns only discovered loopback HTTP URLs, not raw logs. A URL is not human approval or a readiness probe. Multiple/no URLs require clarification/manual fallback. User-managed URLs need no call and are never owned. Stop before leaving UI. No installs, scans, infrastructure or generic jobs.",
    parameters: Type.Object({
      action: Type.Union([Type.Literal("start"), Type.Literal("status"), Type.Literal("stop")]),
      command: Type.Optional(Type.String({ minLength: 1 })),
      args: Type.Optional(Type.Array(Type.String())),
      cwd: Type.Optional(Type.String({ description: "Absolute inspected application directory inside this validated task root." })),
    }),
    async execute(_id, params, signal, _update, ctx) {
      const state = restore(ctx);
      if (state?.mode !== "ui" || !state.task) throw new Error("Owned dev servers are UI-only; use manual startup/URL outside UI.");
      const abort = signal && ctx.signal ? AbortSignal.any([signal, ctx.signal]) : signal ?? ctx.signal;
      abort?.throwIfAborted();
      // Stop remains available even if workspace identity has since broken.
      if (params.action === "stop") await server.stop();
      else {
        const data = await association(ctx.cwd, state.task, abort);
        if (!data) throw new Error("No validated task workspace.");
        if (params.action === "start") {
          if (!params.command || !params.cwd || !isAbsolute(params.cwd)) throw new Error("Start requires inspected command and absolute application cwd.");
          const cwd = realpathSync(params.cwd), location = relative(data.root, cwd);
          if (location === ".." || location.startsWith(`..${sep}`) || isAbsolute(location)) throw new Error("Dev-server cwd must be inside the task root.");
          await server.start(params.command, params.args ?? [], cwd, abort);
        } else if (params.action !== "status") throw new Error("Expected start/status/stop.");
      }
      const status = server.status();
      return { content: [{ type: "text", text: JSON.stringify(status) }], details: status };
    },
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    try { await server.stop(); }
    catch (error) { ctx.ui.notify(`Owned UI-server cleanup failed: ${String(error)}. Manual recovery may be needed; no unrelated process was targeted.`, "warning"); }
  });
  pi.on("session_start", async (_event, ctx) => { await sync(ctx, restore(ctx)); });
  pi.on("session_tree", async (_event, ctx) => { await sync(ctx, restore(ctx)); });
  pi.on("before_agent_start", async (event, ctx) => {
    const state = restore(ctx);
    await sync(ctx, state);
    if (!state) return;
    try {
      if (!state.task) throw new Error("Legacy/unassociated workflow session: ask for user direction; enter the correct task worktree and resume its workflow session, or start /work to enter Plan first. Do not migrate pending changes automatically.");
      await association(ctx.cwd, task(state.task), ctx.signal);
    } catch (error) {
      event.systemPromptOptions.sections.workflow = `Workflow paused: ${String(error)}\nDo not execute phase work or mutate Git. Explain recovery and wait for user direction. Actual cwd: ${ctx.cwd}`;
      return;
    }
    let prompt: string;
    try { prompt = instructions(state.mode); }
    catch (error) {
      const paused = `Workflow paused: ${String(error)}\nDo not execute phase work or mutate Git. Explain the exact file problem and wait for repair or user direction. Chat and recovery/return remain available; after repair explicitly retry in chat. Actual cwd: ${ctx.cwd}`;
      ctx.ui.notify(paused, "warning");
      event.systemPromptOptions.sections.workflow = paused;
      return;
    }
    const skills: string[] = [];
    for (const name of SKILLS[state.mode]) {
      try {
        const skill = event.systemPromptOptions.skills?.find((item) => item.name === name);
        if (!skill) throw new Error("not installed in this session");
        skills.push(`<skill name="${name}" location="${skill.filePath}">\nReferences are relative to ${skill.baseDir}.\n\n${readFileSync(skill.filePath, "utf8")}\n</skill>`);
      } catch (error) {
        ctx.ui.notify(`Skill ${name} unavailable; continuing with the phase instructions: ${String(error)}`, "warning");
      }
    }
    event.systemPromptOptions.sections.workflow = `${skills.join("\n\n")}\n\n${prompt}\n\n${taskGuidance(state.task)}\nTask workspace: ${JSON.stringify(state.task)}\nThis task association is workspace context, not progress or approval. ${state.task.kind === "directory" ? "All phases edit this actual directory in place; no isolation or Git baseline exists." : "All phases reuse this checkout; worktrees are not a sandbox."}\nPhase: ${state.mode}\nInput: ${state.input || "not supplied — ask the user"}${state.notes ? `\nHandoff notes: ${state.notes}` : ""}`;
  });
}

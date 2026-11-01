import { readFileSync, realpathSync } from "node:fs";
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
const command = ({ mode, input }: Phase) => `/${mode}${input ? ` ${input}` : ""}`;
const guidance = (data: Task) => `The workflow guides; it never restricts Pi or overrides the user's changes of direction.
Use ordinary Pi tools for files, research, and checks; inspect Git only for managed Git tasks. Preserve existing user work. Read the complete selected reference and relevant code; open other project docs only when named or needed to resolve missing context or a concrete contradiction/safety issue.
Explicit user/task paths or applicable project-owned workflow/agent instructions take precedence per artifact type; a path for one type does not redirect another. Otherwise save Plans to ~/.pi/plans/<project-key>/<task-id>.md, Plan feedback to ~/.pi/plans/<project-key>/<task-id>-<topic>.md, and standalone Review and workflow UI/feedback reports to ~/.pi/reviews/<project-key>/<task-id>-<topic>-<UTC timestamp>.md. Use the validated task association's projectKey and id from the recorded canonical repository (or canonical non-Git root), never the generated worktree basename or task prose. Preserve exact original-plan, predecessor, and report references; do not rename or migrate them to match defaults. Clarify conflicting/shared targets before overwriting; choose a new filename if a new report's default already exists. Existing directories or historical files alone are not overrides. These are instruction-only defaults, not enforced locations; ordinary Pi tools write the files. Expand ~ before calling filesystem tools unless they support tilde expansion. Read before revising; preserve input reports and earlier review reports in Plan, Build, Review, and UI. Finalize alone may replace the current task's implementation plan with final decisions/reasons and delete its other identified, fully consolidated artifacts only after writing and reading back the summary successfully; preserve unrelated/shared artifacts. Handoff documents must stand alone without this conversation.
For implementation loops, keep the original implementation plan as primary input. Before acting, every Build/Review session reads the complete original plan, applicable instructions, and latest same-task progress/review references. Use existing handoff notes to carry explicit loop authorization (never infer it from a filename or report), current stable feature identity or whole-plan review kind, next action, and absolute progress/report references; forward predecessor and clarification paths. Reuse standalone Review reports as cumulative progress snapshots, not a separate state store or routine build journal. Preserve the original plan and earlier reports until Finalize's bounded consolidation. A single-feature or older unnumbered plan is one implementation unit unless its divisions or dependencies are genuinely ambiguous. Restoring a session never automatically dispatches work; reconcile missing, stale, or conflicting progress from code, checks, and referenced reports before continuing, never guess completion.
An explicitly authorized implementation loop runs one eligible feature per Build, fresh independent feature Review, automatic in-scope fixes, then the next eligible feature in plan order. No routine approval picker or browser interrupts that loop. Defer evidenced blockers without a numerical retry cap; exhaust safe independent work and whole-plan corrections before asking consolidated blocking questions. After eligible feature work/reviews are exhausted, run fresh whole-plan Review; in-scope findings return to focused Build then fresh whole-plan Review. Only a clean whole-plan verdict (no incomplete features, unresolved actionable findings, or blockers) reaches human approval. Standalone /review remains read-only with an explicit findings-routing choice; a filename or prior report never authorizes implementation. New scope/design, dependencies, installs, destructive actions, E2E, and Git writes still need explicit authority.
Clean standalone and clean whole-plan Review offer exactly: ${data.kind === "directory" ? "Approve code and go to UI; Approve code, skip UI, and go to Finalize. No browser file/code review outside Git; use explicitly scoped files and plan/check evidence, and disclose that no Git baseline exists" : "Review code in Plannotator; Approve code and go to UI; Approve code, skip UI, and go to Finalize"}. Code review is opt-in with an explicit approval gate, never automatic. Direct approval routes once to the named phase with the resolved original plan; browser selection alone authorizes no destination. Forward all known same-task artifact paths and material decisions/reasons through UI/Finalize notes.
Use workflow_question for finite workflow decisions, with context and explicit action labels; use chat for free-form tasks, references, URLs, and substantive feedback. A selected action authorizes only what the question clearly describes. Do not add a question gate to already-authorized transitions. On cancellation or abort, wait for chat without dispatching, choosing a default, or reopening the picker; without UI, ask the returned question/options in chat.
Use the installed plannotator tool for artifact and live-app reviews, not native plan mode or a private integration. Before opening, explain the next step and ask the user to reply in chat if they close without deciding (a plain close may send no message). End the turn after opening. If unavailable, dismissed, or unclear, use workflow_question for finite choices such as approve, retry, stop, or change direction once the conversation resumes; use chat for open-ended clarification. Never infer approval from silence or failure. Approval notes are guidance, not new scope.
When the next phase is known and authorized, call workflow_handoff once with its mode, the absolute plan/report path, and any short handoff notes. Otherwise use workflow_question for finite choices or chat for free-form clarification. The helper creates the fresh session; do not create it yourself or continue into another phase here. No receipts, mandatory phase order, or completed-session locks.
When the user explicitly asks to return/exit without publishing, call workflow_exit once and end the turn. /workflow-exit does the same. Interpret chat intent normally; quoted examples or a bare exit never authorize publication. Return leaves pending files, branch, worktree, sessions, and artifacts intact; it marks nothing approved or complete. To resume a managed Git task, enter the retained task checkout and select a phase or resume its session. For a non-Git task, resume its session; a new unrelated session creates a new task, never rediscovers an old one. If return fails/cancels, wait for chat and use the reported actual-cwd/manual recovery; never assume it succeeded.
${data.kind === "directory" ? "Non-Git task: work directly in the validated directory. No repository/worktree creation, Git status/diff/publication, signing or authentication requests. In-place files (including symlink destinations) have no isolation, baseline or implicit rollback. Plan remains non-mutating; Review remains read-only. UI may use the inspected owned-server helper inside this root. Successful Finalize consolidates and verifies documentation, reports outcomes, then automatically calls workflow_exit without publicationUrl and ends the turn. Incomplete/failed Finalize stays for recovery; explicit exit is always available. A repository appearing later pauses this task, never grants publication authority." : `Extension-driven task branch/worktree setup and authorized Finalize task-only publication are narrow automatic Git-write exceptions. After setup Plan is non-mutating research; Build and Review remain Git-read-only outside explicitly authorized disposable test fixtures. UI alone may use workflow_ui_server for an inspected existing dev command in this task checkout, with task authority and safe data effects established; it owns only its child process group. Reuse an explicitly requested user-managed URL without taking ownership. No install, migration, infrastructure startup, port scan, credential injection, or generic process management. Stop the owned server before handoff/exit; session shutdown/reload also cleans up. After consolidation and scoped formatting checks, Finalize with established implementation/publication authority stages only identified task changes, creates/reuses signed task commits with existing GPG identity/hooks, normally pushes only the task branch through the existing SSH remote/agent, and creates/reuses an explicit-repository/head/base gh PR. Use ordinary Git/gh tools, no publishing runner or receipt. Locked keys or missing gh authentication pause for user-operated terminal recovery and confirmation; inspect actual state before retrying only the unresolved step. No secrets, unsigned fallback, token/HTTPS migration, remote/credential rewrite, implicit fork/push, force-push, CI polling or merge. Default PR base is GitHub's repository default branch unless explicitly overridden. Report the verified PR URL, then call workflow_exit with publicationUrl to return; failures stay in the task. A standalone Review or documentation-only Finalize grants no publication authority. Task creation grants no general Git, service, credential, destructive, installation, or deployment authority.`}`;

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
  const { association, entrySession, git, nonGit, task, workspace } = await import(join(source, "workflow/workspace.ts"));
  const directory = join(getAgentDir(), "workflow");
  let selected = false, uiSelected = false;
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
    const manual = command(state);
    // The UI channel survives replacement; the context getter does not.
    const notify = ctx.ui.notify.bind(ctx.ui);
    const selection = { model: ctx.model && { provider: ctx.model.provider, id: ctx.model.id }, thinking: ctx.thinkingLevel };
    const sourceCwd = ctx.cwd;
    let recovery = `Current workspace: ${sourceCwd}`;
    const fallback = (error: unknown) => `Workflow could not start ${state.mode}: ${String(error)}\n${recovery}\nNo fallback work was started in the source checkout. If replacement failed, relaunch Pi in the retained task workspace; otherwise retry there:\n${manual}${state.notes ? `\nHandoff notes:\n${state.notes}` : ""}`;
    try {
      await ctx.waitForIdle();
      ctx.signal?.throwIfAborted();
      await server.stop();
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

  async function exit(ctx: ExtensionCommandContext, published?: unknown) {
    const notify = ctx.ui.notify.bind(ctx.ui);
    const actualCwd = ctx.cwd;
    const selection = { model: ctx.model && { provider: ctx.model.provider, id: ctx.model.id }, thinking: ctx.thinkingLevel };
    let recovery = `Actual cwd before return: ${actualCwd}`;
    try {
      await ctx.waitForIdle();
      ctx.signal?.throwIfAborted();
      const state = restore(ctx);
      const pr = publicationUrl(published, state?.mode, state?.task);
      if (pr) recovery += `\nReported published PR: ${pr}`;
      if (state && !state.task) throw new Error("Legacy/unassociated workflow session; ask for recovery direction, not automatic migration.");
      const data = await association(actualCwd, state?.task, ctx.signal);
      if (!data) throw new Error("No managed task association; ordinary Pi is unchanged.");
      recovery += `\nRetained task workspace: ${data.root}\nOriginal launch cwd: ${data.originalCwd}`;
      if (!ctx.sessionManager.getSessionFile()) throw new Error("Return needs a persistent session; use the manual launch route.");
      await server.stop();
      const pending = data.kind !== "directory" && await git(data.root, ["status", "--porcelain=v1", "--untracked-files=all"], ctx.signal);
      const notice = `Returned to ${data.originalCwd}. Ordinary Pi; no work started. Task retained at ${data.root}.${pending ? " Pending files remain there." : ""} ${pr ? `Published PR: ${pr}. CI and merge remain yours; no integration or cleanup performed.` : "Nothing was published, approved, or marked complete."}`;
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
        } catch (error) {
          await next.sendMessage({ customType: "workflow-notice", content: `Return validation failed: ${String(error)}\nActual cwd: ${next.cwd}\n${recovery}\nNo work started. Relaunch Pi manually in the original directory, or resume the retained task.`, display: true }, { triggerTurn: false });
        }
      } });
      if (result.cancelled) throw new Error("Session replacement cancelled; return not completed.");
    } catch (error) {
      notify(`Workflow return failed: ${String(error)}\n${recovery}\nIf replacement failed, the active workspace may be unavailable; verify cwd before continuing. Relaunch Pi manually in the original launch directory for ordinary mode, or in the retained task to resume. No Git state or task resources were changed by exit.`, "warning");
    }
  }

  pi.registerCommand("workflow-exit", {
    description: "Return to the original launch directory in fresh ordinary Pi, without publishing or deleting task resources",
    handler: async (args, ctx) => {
      try { await exit(ctx, args.trim() ? JSON.parse(args) : undefined); }
      catch (error) { ctx.ui.notify(`Invalid return context: ${String(error)}. Use /workflow-exit without arguments to return without publication.`, "warning"); }
    },
  });

  for (const mode of MODES) {
    pi.registerCommand(mode, {
      description: `Start ${mode} in a fresh session: /${mode} [${mode === "plan" ? "task or report" : "plan/reference"}]. ${mode === "plan" ? "Create/reuse a Git task worktree, or work in place outside Git." : "Use a managed Git task worktree, or work in place outside Git."} Missing input is clarified in chat.`,
      handler: async (input, ctx) => start({ mode, input }, ctx),
    });
  }
  pi.registerCommand("workflow-handoff", {
    description: "Workflow helper dispatch: start a fresh phase from its JSON mode, input, and optional notes",
    handler: async (args, ctx) => {
      try {
        const state = phase(JSON.parse(args));
        if (!state) throw new Error("Expected { mode, input, notes? }.");
        // Task association comes from the workspace/session, never model-supplied JSON.
        await start({ mode: state.mode, input: state.input, notes: state.notes }, ctx);
      } catch (error) { ctx.ui.notify(`Invalid workflow handoff: ${String(error)}`, "warning"); }
    },
  });
  pi.registerCommand("workflow", {
    description: "Show the current phase and workflow help",
    handler: async (_args, ctx) => {
      const state = restore(ctx);
      let context: string, inPlace = state?.task?.kind === "directory";
      try {
        if (state && !state.task) throw new Error("Legacy/unassociated workflow session; ask for user direction, not automatic migration.");
        const data = await association(ctx.cwd, state?.task, ctx.signal);
        inPlace = data?.kind === "directory" || (!data && await nonGit(ctx.cwd, ctx.signal));
        context = data ? taskGuidance(data) : inPlace ? "Non-Git directory: any phase starts a new in-place task. No identity selected; resume an existing session to continue it. No Git baseline, isolation or rollback; no automatic task/plan rediscovery." : "No managed task worktree. Start /plan for a new task, or enter the existing task checkout; do not migrate pending changes automatically.";
      } catch (error) { context = `Workflow paused: ${String(error)}\nActual cwd: ${ctx.cwd}\nAsk for recovery direction; do not execute phase work or mutate Git.`; }
      if (inPlace) {
        pi.sendMessage({ customType: "workflow-notice", display: true, content:
          `Phase: ${state?.mode ?? "not selected"}\nInput: ${state?.input || "ask in chat"}\n${context}\n\n/plan [task/report]; /build [plan]; /review [reference]; /ui [reference]; /finalize [reference]. Any phase starts immediately in a fresh same-directory session; missing input is clarified in chat. No repository, worktree, directory metadata, copying, or automatic backup is created.\nPlan → per-feature Build ↔ Review → whole-plan Review ↔ focused Build → optional UI → Finalize. Authorized loops fix in-scope findings; standalone Review stays read-only. Review explicitly scoped task files against the plan and checks: no Git baseline or exhaustive diff detection. Clean standalone/whole-plan Review offers exactly: Approve code and go to UI; Approve code, skip UI, and go to Finalize. No browser file review outside Git; live UI review remains available.\nUI alone may manage an inspected existing dev command within the task root through workflow_ui_server; user-managed URLs remain unowned. Owned processes stop on departure, return, reload and shutdown. Successful Finalize consolidates/checks task documentation, reports outcomes, then automatically calls workflow_exit without publicationUrl. Failures stay for recovery. No Git publication or signing/authentication requests, even if a repository appears later; pause for direction instead.\n/workflow-exit returns to the original launch cwd in fresh ordinary Pi without publishing, approving, deleting files/artifacts or starting work. Chat return requests use workflow_exit. Identity follows the active session branch across handoff/reload/resume/tree; restoration starts no work. Resume the session to continue the task. A new unrelated session starts a new identity, even with an explicit existing plan; exact references/overrides stay authoritative without filename migration or latest-task discovery. In-place edits affect real files and symlink destinations without isolation, baseline or rollback. Pi owns models, thinking, tools and permissions. Prompts: ${directory}`,
        }, { triggerTurn: false });
        return;
      }
      pi.sendMessage({ customType: "workflow-notice", display: true, content:
        `Phase: ${state?.mode ?? "not selected"}\nInput: ${state?.input || "ask in chat"}\n${context}\n\nPlan → per-feature Build ↔ Review → whole-plan Review ↔ focused Build → optional UI → Finalize.\nAuthorized loops automatically fix in-scope findings and advance eligible features; defer blockers, exhaust independent work, then ask. Standalone /review stays read-only and asks before findings routing.\nClean standalone/whole-plan Review offers: Review code in Plannotator; Approve code and go to UI; Approve code, skip UI, and go to Finalize. Browser review is opt-in; direct approval routes once with the resolved original plan.\n/plan [task/report]; /build [plan]; /review [reference]; /ui [reference]; /finalize [reference].\nEach command starts a fresh session. /plan creates one branch/worktree from launching HEAD; /plan in a managed task reuses it. Pending source files stay behind after an explicit choice. Direct phases outside a managed task pause; enter the correct task worktree or start /plan. Any phase can be selected or repeated inside a managed task. Use workflow_question for finite next-step choices, chat for free-form clarification, and workflow_handoff when the destination is known and authorized.\nTask setup and authorized Finalize task-only publication are narrow Git-write exceptions. UI alone can manage an inspected existing task dev command through workflow_ui_server; manual URLs stay user-owned. Owned servers stop on UI departure, return, reload and orderly shutdown. Authorized Finalize consolidates/checks docs, stages exact task changes, signs with existing GPG, pushes only the task branch over existing SSH, creates/reuses a gh PR with explicit repo/head/base, reports its URL and returns. Locked agents or separate gh login pause for user terminal recovery, confirmation and state reconciliation. No credential migration, unsigned fallback, force-push, automatic fork, CI polling or merge. Documentation-only Finalize/standalone Review do not authorize publication. /workflow-exit returns to the original launch cwd in fresh ordinary Pi without publishing, approving, deleting resources, or starting work; pending files stay in the retained task. Chat return requests use phase-scoped workflow_exit; resume later in the task checkout. Pi owns models, thinking, tools, and permissions. Prompts: ${directory}`,
      }, { triggerTurn: false });
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
      const manual = command(params);
      const fallback = `If it does not open, keep chatting or run:\n${manual}${params.notes ? `\nHandoff notes:\n${params.notes}` : ""}`;
      try {
        pi.sendUserMessage(`/workflow-handoff ${JSON.stringify(params)}`, { deliverAs: "followUp", expandPromptTemplates: true });
      } catch (error) {
        return { content: [{ type: "text", text: `Handoff request failed: ${String(error)}\n${fallback}` }], details: undefined, isError: true };
      }
      return { content: [{ type: "text", text: `Requested a fresh ${params.mode} session. ${fallback}` }], details: undefined, terminate: true };
    },
  });

  pi.registerTool({
    name: EXIT, label: "Return to ordinary Pi", defaultActive: false,
    exposure: "model-only", executionMode: "sequential",
    description: "Return to fresh ordinary Pi at the original launch cwd on explicit exit, after successful non-Git Finalize, or after confirmed authorized Git Finalize publication. This tool never publishes. Omit publicationUrl for exit without publishing; only managed Git Finalize may supply the verified PR URL as display context, not proof/authority. Preserves pending files, branch/worktree, sessions and artifacts. End the turn after calling. On failure preserve any PR URL and use /workflow-exit or manual relaunch; never assume return succeeded.",
    parameters: Type.Object({ publicationUrl: Type.Optional(Type.String({ description: "Managed-Git Finalize-only verified HTTPS PR URL, after reporting successful publication. Display context only." })) }),
    async execute(_id, params, signal, _update, ctx) {
      if (signal?.aborted || ctx.signal?.aborted) throw new Error("Workflow exit cancelled.");
      const state = restore(ctx);
      if (!state) throw new Error("Workflow exit helper is phase-scoped; use /workflow-exit from a managed task.");
      const pr = publicationUrl(params.publicationUrl, state.mode, state.task);
      const dispatch = `/workflow-exit${pr ? ` ${JSON.stringify(pr)}` : ""}`;
      try {
        pi.sendUserMessage(dispatch, { deliverAs: "followUp", expandPromptTemplates: true });
      } catch (error) {
        return { content: [{ type: "text", text: `Return request failed: ${String(error)}.${pr ? ` Published PR: ${pr}.` : ""} Run /workflow-exit or relaunch Pi manually in the original directory; task resources remain intact.` }], details: undefined, isError: true };
      }
      return { content: [{ type: "text", text: `Requested return${pr ? ` after publication: ${pr}` : " without publication"}. If it does not open, wait for chat or run /workflow-exit; task resources remain intact.` }], details: undefined, terminate: true };
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
      if (!state.task) throw new Error("Legacy/unassociated workflow session: ask for user direction; enter the correct task worktree or start /plan. Do not migrate pending changes automatically.");
      await association(ctx.cwd, task(state.task), ctx.signal);
    } catch (error) {
      event.systemPromptOptions.sections.workflow = `Workflow paused: ${String(error)}\nDo not execute phase work or mutate Git. Explain recovery and wait for user direction. Actual cwd: ${ctx.cwd}`;
      return;
    }
    let prompt: string;
    try { prompt = readFileSync(join(directory, `${state.mode}.md`), "utf8"); }
    catch (error) {
      ctx.ui.notify(`Workflow prompt unavailable; continuing without it: ${String(error)}`, "warning");
      prompt = `Help the user with the ${state.mode} phase; ask about missing requirements.`;
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
    event.systemPromptOptions.sections.workflow = `${skills.join("\n\n")}\n\n${guidance(state.task)}\n\n${prompt}\n\n${taskGuidance(state.task)}\nTask workspace: ${JSON.stringify(state.task)}\nThis task association is workspace context, not progress or approval. ${state.task.kind === "directory" ? "All phases edit this actual directory in place; no isolation or Git baseline exists." : "All phases reuse this checkout; worktrees are not a sandbox."}\nPhase: ${state.mode}\nInput: ${state.input || "not supplied — ask the user"}${state.notes ? `\nHandoff notes: ${state.notes}` : ""}`;
  });
}

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Type } from "typebox";
import { colorToRgb, rgbColor, type Color } from "@earendil-works/pi-tui";
import { getAgentDir, type ExtensionAPI, type ExtensionCommandContext, type ExtensionContext } from "@earendil-works/pi-coding-agent";

const MODES = ["plan", "build", "review", "ui", "finalize"] as const;
type Mode = typeof MODES[number];
type Phase = { mode: Mode; input: string; notes?: string };
const STATE = "workflow-phase";
const TOOL = "workflow_handoff";
const QUESTION = "workflow_question";
const TOOLS = [TOOL, QUESTION];
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
const guidance = `The workflow guides; it never restricts Pi or overrides the user's changes of direction.
Use ordinary Pi tools for files, Git inspection, research, and checks. Preserve existing user work. Read the complete selected reference and relevant code; open other project docs only when named or needed to resolve missing context or a concrete contradiction/safety issue.
Explicit user/task paths or applicable project-owned workflow/agent instructions take precedence per artifact type; a path for one type does not redirect another. Otherwise save Plans and Plan feedback reports to ~/.pi/plans/<project-key>/<task>.md, and standalone Review and workflow UI/feedback reports to ~/.pi/reviews/<project-key>/<task>-<UTC timestamp>.md. Derive <project-key> from the project/repository root directory name; add enough parent path to disambiguate same-named projects, and ask if identity remains unclear rather than mix or overwrite artifacts. Existing directories or historical files alone are not overrides. These are instruction-only defaults, not enforced locations; ordinary Pi tools write the files. Expand ~ before calling filesystem tools unless they support tilde expansion. Read before revising; preserve input reports and earlier review reports in Plan, Build, Review, and UI. Finalize alone may replace the current task's implementation plan with final decisions/reasons and delete its other identified, fully consolidated artifacts only after writing and reading back the summary successfully; preserve unrelated/shared artifacts. Handoff documents must stand alone without this conversation.
For implementation loops, keep the original implementation plan as primary input. Before acting, every Build/Review session reads the complete original plan, applicable instructions, and latest same-task progress/review references. Use existing handoff notes to carry explicit loop authorization (never infer it from a filename or report), current stable feature identity or whole-plan review kind, next action, and absolute progress/report references; forward predecessor and clarification paths. Reuse standalone Review reports as cumulative progress snapshots, not a separate state store or routine build journal. Preserve the original plan and earlier reports until Finalize's bounded consolidation. A single-feature or older unnumbered plan is one implementation unit unless its divisions or dependencies are genuinely ambiguous. Restoring a session never automatically dispatches work; reconcile missing, stale, or conflicting progress from code, checks, and referenced reports before continuing, never guess completion.
An explicitly authorized implementation loop runs one eligible feature per Build, fresh independent feature Review, automatic in-scope fixes, then the next eligible feature in plan order. No routine approval picker or browser interrupts that loop. Defer evidenced blockers without a numerical retry cap; exhaust safe independent work and whole-plan corrections before asking consolidated blocking questions. After eligible feature work/reviews are exhausted, run fresh whole-plan Review; in-scope findings return to focused Build then fresh whole-plan Review. Only a clean whole-plan verdict (no incomplete features, unresolved actionable findings, or blockers) reaches human approval. Standalone /review remains read-only with an explicit findings-routing choice; a filename or prior report never authorizes implementation. New scope/design, dependencies, installs, destructive actions, E2E, and Git writes still need explicit authority.
Clean standalone and clean whole-plan Review offer exactly: Review code in Plannotator; Approve code and go to UI; Approve code, skip UI, and go to Finalize. Code review is opt-in with an explicit approval gate, never automatic. Direct approval routes once to the named phase with the resolved original plan; browser selection alone authorizes no destination. Forward all known same-task artifact paths and material decisions/reasons through UI/Finalize notes.
Use workflow_question for finite workflow decisions, with context and explicit action labels; use chat for free-form tasks, references, URLs, and substantive feedback. A selected action authorizes only what the question clearly describes. Do not add a question gate to already-authorized transitions. On cancellation or abort, wait for chat without dispatching, choosing a default, or reopening the picker; without UI, ask the returned question/options in chat.
Use the installed plannotator tool for artifact and live-app reviews, not native plan mode or a private integration. Before opening, explain the next step and ask the user to reply in chat if they close without deciding (a plain close may send no message). End the turn after opening. If unavailable, dismissed, or unclear, use workflow_question for finite choices such as approve, retry, stop, or change direction once the conversation resumes; use chat for open-ended clarification. Never infer approval from silence or failure. Approval notes are guidance, not new scope.
When the next phase is known and authorized, call workflow_handoff once with its mode, the absolute plan/report path, and any short handoff notes. Otherwise use workflow_question for finite choices or chat for free-form clarification. The helper creates the fresh session; do not create it yourself or continue into another phase here. No receipts, mandatory phase order, or completed-session locks. Leave Git writes to the user.`;

function phase(value: unknown): Phase | undefined {
  const data = value as Phase | undefined;
  return data && MODES.includes(data.mode) && typeof data.input === "string" &&
    (data.notes === undefined || typeof data.notes === "string") ? data : undefined;
}

export default function workflowModes(pi: ExtensionAPI) {
  const directory = join(getAgentDir(), "workflow");
  let selected = false;
  const restore = (ctx: ExtensionContext) => {
    const entry = [...ctx.sessionManager.getBranch()].reverse()
      .find((entry) => entry.type === "custom" && entry.customType === STATE);
    return entry?.type === "custom" ? phase(entry.data) : undefined;
  };

  function sync(ctx: ExtensionContext, state: Phase | undefined) {
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
  }

  async function start(state: Phase, ctx: ExtensionCommandContext) {
    const manual = command(state);
    let destination: ExtensionContext = ctx;
    const fallback = (error: unknown) => `Workflow could not start ${state.mode}: ${String(error)}\nYou can keep chatting, or try manually:\n${manual}${state.notes ? `\nHandoff notes:\n${state.notes}` : ""}`;
    try {
      await ctx.waitForIdle();
      const skill = state.mode === "build" ? "ponytail" : state.mode === "review" ? "ponytail-review" : undefined;
      const available = skill && pi.getCommands().some((item) => item.name === `skill:${skill}` && item.source === "skill");
      if (skill && !available) ctx.ui.notify(`Skill ${skill} unavailable; continuing with the phase instructions.`, "warning");
      const request = `Begin ${state.mode} now; do not ask for another start confirmation.\n\n${state.input.trim() ? `User input (task/report or plan/reference):\n${state.input}` : "Ask the user for the task or plan/reference you need."}${state.notes ? `\n\nHandoff notes:\n${state.notes}` : ""}`;
      // Session replacement reloads extensions: persist plain data and use only the fresh context afterward.
      const result = await ctx.newSession({
        setup: async (manager) => { manager.appendCustomEntry(STATE, state); },
        withSession: async (next) => {
          destination = next;
          try {
            await next.sendUserMessage(available ? `/skill:${skill} ${request}` : request, { expandPromptTemplates: Boolean(available) });
          } catch (error) {
            await next.sendMessage({ customType: "workflow-notice", content: fallback(error), display: true }, { triggerTurn: false });
          }
        },
      });
      if (result.cancelled) ctx.ui.notify(fallback("session creation cancelled"), "warning");
    } catch (error) {
      destination.ui.notify(fallback(error), "warning");
    }
  }

  for (const mode of MODES) {
    pi.registerCommand(mode, {
      description: `Start ${mode} in a fresh session: /${mode} [${mode === "plan" ? "task or report" : "plan/reference"}]. Missing input is clarified in chat.`,
      handler: async (input, ctx) => start({ mode, input }, ctx),
    });
  }
  pi.registerCommand("workflow-handoff", {
    description: "Workflow helper dispatch: start a fresh phase from its JSON mode, input, and optional notes",
    handler: async (args, ctx) => {
      try {
        const state = phase(JSON.parse(args));
        if (!state) throw new Error("Expected { mode, input, notes? }.");
        await start(state, ctx);
      } catch (error) { ctx.ui.notify(`Invalid workflow handoff: ${String(error)}`, "warning"); }
    },
  });
  pi.registerCommand("workflow", {
    description: "Show the current phase and workflow help",
    handler: async (_args, ctx) => {
      const state = restore(ctx);
      pi.sendMessage({ customType: "workflow-notice", display: true, content:
        `Phase: ${state?.mode ?? "not selected"}\nInput: ${state?.input || "ask in chat"}\n\nPlan → per-feature Build ↔ Review → whole-plan Review ↔ focused Build → optional UI → Finalize.\nAuthorized loops automatically fix in-scope findings and advance eligible features; defer blockers, exhaust independent work, then ask. Standalone /review stays read-only and asks before findings routing.\nClean standalone/whole-plan Review offers: Review code in Plannotator; Approve code and go to UI; Approve code, skip UI, and go to Finalize. Browser review is opt-in; direct approval routes once with the resolved original plan.\n/plan [task/report]; /build [plan]; /review [reference]; /ui [reference]; /finalize [reference].\nEach command starts a fresh session. Any phase can be selected or repeated. Use workflow_question for finite next-step choices, chat for free-form clarification, and workflow_handoff when the destination is known and authorized.\nPi owns models, thinking, tools, and permissions. Prompts: ${directory}`,
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

  pi.on("session_start", (_event, ctx) => { sync(ctx, restore(ctx)); });
  pi.on("session_tree", (_event, ctx) => { sync(ctx, restore(ctx)); });
  pi.on("before_agent_start", (event, ctx) => {
    const state = restore(ctx);
    sync(ctx, state);
    if (!state) return;
    let prompt: string;
    try { prompt = readFileSync(join(directory, `${state.mode}.md`), "utf8"); }
    catch (error) {
      ctx.ui.notify(`Workflow prompt unavailable; continuing without it: ${String(error)}`, "warning");
      prompt = `Help the user with the ${state.mode} phase; ask about missing requirements.`;
    }
    event.systemPromptOptions.sections.workflow = `${guidance}\n\n${prompt}\n\nPhase: ${state.mode}\nInput: ${state.input || "not supplied — ask the user"}${state.notes ? `\nHandoff notes: ${state.notes}` : ""}`;
  });
}

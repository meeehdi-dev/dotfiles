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
Explicit user/task paths or applicable project-owned workflow/agent instructions take precedence per artifact type; a path for one type does not redirect another. Otherwise save Plans and Plan feedback reports to ~/.pi/plans/<project-key>/<task>.md, and standalone Review and workflow UI/feedback reports to ~/.pi/reviews/<project-key>/<task>-<UTC timestamp>.md. Derive <project-key> from the project/repository root directory name; add enough parent path to disambiguate same-named projects, and ask if identity remains unclear rather than mix or overwrite artifacts. Existing directories or historical files alone are not overrides. These are instruction-only defaults, not enforced locations; ordinary Pi tools write the files. Expand ~ before calling filesystem tools unless they support tilde expansion. Read before revising; preserve input reports and earlier review reports. Handoff documents must stand alone without this conversation.
Use the installed plannotator tool for reviews/questions, not native plan mode or a private integration. Before opening, explain the next step and ask the user to reply in chat if they close without deciding (a plain close may send no message). End the turn after opening. If unavailable, dismissed, or unclear, ask in chat whether to approve, retry, stop, or change direction. Never infer approval from silence or failure. Approval notes are guidance, not new scope.
When the next phase is known and authorized, call workflow_handoff once with its mode, the absolute plan/report path, and any short handoff notes. Otherwise ask the user. The helper creates the fresh session; do not create it yourself or continue into another phase here. No receipts, mandatory phase order, or completed-session locks. Leave Git writes to the user.`;

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
      const others = pi.getActiveTools().filter((name) => name !== TOOL);
      pi.setActiveTools(state ? [...others, TOOL] : others);
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
        `Phase: ${state?.mode ?? "not selected"}\nInput: ${state?.input || "ask in chat"}\n\nPlan → Build → Review → optional UI → Finalize.\n/plan [task/report]; /build [plan]; /review [reference]; /ui [reference]; /finalize [reference].\nEach command starts a fresh session. Any phase can be selected or repeated. Ask in chat when the next step is unclear; use workflow_handoff when it is known.\nPi owns models, thinking, tools, and permissions. Prompts: ${directory}`,
      }, { triggerTurn: false });
    },
  });
  pi.registerTool({
    name: TOOL, label: "Start the next workflow phase", defaultActive: false, executionMode: "sequential",
    description: "Start a chosen workflow phase in a fresh session. Use once the next step is authorized; ask the user if it is unclear. Input is the absolute saved plan/report path (or a new Plan task). Notes carry concise context/guidance, never the previous transcript. Does not save files, review, approve, or enforce phase ordering.",
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

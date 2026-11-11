import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { promisify } from "node:util";
import { Type } from "typebox";
import { colorToRgb, rgbColor, type Color } from "@earendil-works/pi-tui";
import { getAgentDir, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";

const exec = promisify(execFile);
const MODES = ["plan", "build", "review", "ui", "finalize"] as const;
type Mode = typeof MODES[number];
type Task = { id: string; kind: "git" | "directory"; projectKey: string; root: string; commit?: string; pending?: string[] };
type Phase = { mode: Mode; input: string; notes?: string; task: Task };
const STATE = "workflow-phase";
const TOOLS = ["workflow_phase", "workflow_question", "workflow_exit"];
const BADGES: Record<Mode, "accent" | "success" | "warning" | "muted"> = { plan: "accent", build: "warning", review: "muted", ui: "accent", finalize: "success" };
const BLACK = rgbColor(0, 0, 0), WHITE = rgbColor(255, 255, 255);

function contrast(color: Color) {
  const linear = (v: number) => (v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  const { r, g, b } = colorToRgb(color);
  const l = 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
  return (l + 0.05) / 0.05 >= 1.05 / (l + 0.05) ? BLACK : WHITE;
}

const key = (name: string, path: string) => `${name.replace(/[^\w.-]/g, "-")}-${createHash("sha256").update(path).digest("hex").slice(0, 12)}`;
async function git(cwd: string, args: string[]) {
  const { stdout } = await exec("git", ["--no-optional-locks", "-C", cwd, ...args], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024, env: { ...process.env, LC_ALL: "C" } });
  return stdout.replace(/\n$/, "");
}

// Git repo: root, start commit, pre-existing changes. Otherwise the folder itself, with no baseline.
async function describeTask(cwd: string): Promise<Task> {
  const id = randomUUID();
  let root: string;
  try { root = realpathSync(await git(cwd, ["rev-parse", "--show-toplevel"])); }
  catch (error) {
    if (!/not a git repository/.test(String((error as { stderr?: string }).stderr))) throw error;
    const dir = realpathSync(cwd);
    return { id, kind: "directory", projectKey: key(basename(dir), dir), root: dir };
  }
  const common = realpathSync(await git(cwd, ["rev-parse", "--path-format=absolute", "--git-common-dir"]));
  const commit = await git(root, ["rev-parse", "--verify", "-q", "HEAD^{commit}"]).catch(() => undefined);
  const pending = (await git(root, ["status", "--porcelain=v1", "--untracked-files=all"])).split("\n").filter(Boolean).map((line) => line.slice(3));
  return { id, kind: "git", projectKey: key(basename(common) === ".git" ? basename(dirname(common)) : basename(common), common), root, commit, pending };
}

function guidance(task: Task) {
  const lines = [`Task id: ${task.id}`, `Task root (use explicitly; pass as subagent cwd and Plannotator target): ${task.root}`,
    `Plan: ~/.pi/plans/${task.projectKey}/${task.id}.md`, `Plan feedback: ~/.pi/plans/${task.projectKey}/${task.id}-<topic>.md`,
    `Reports: ~/.pi/reviews/${task.projectKey}/${task.id}-<topic>-<UTC timestamp>.md`];
  if (task.kind === "directory") lines.push("Kind: non-Git folder, in place. No baseline, no Plannotator code review, no undo.");
  else lines.push(`Kind: Git, in place. Start commit: ${task.commit ?? "none (unborn)"}`,
    `Pre-existing changed paths (the user's, leave alone): ${task.pending?.length ? task.pending.join(", ") : "none"}`);
  return lines.join("\n");
}

export default function workflow(pi: ExtensionAPI) {
  const dir = join(getAgentDir(), "workflow");
  const read = (name: string) => readFileSync(join(dir, `${name}.md`), "utf8");
  const current = (ctx: ExtensionContext) => {
    const entry = [...ctx.sessionManager.getBranch()].reverse().find((e) => e.type === "custom" && e.customType === STATE);
    return entry?.type === "custom" ? entry.data as Phase | null : undefined;
  };
  let active = false;
  const sync = (ctx: ExtensionContext) => {
    const state = current(ctx);
    const color = state && ctx.ui.theme.colors[BADGES[state.mode]];
    ctx.ui.setStatus("workflow", state
      ? ctx.ui.theme.style(` ${state.mode} `, { fg: contrast(color!), bg: color })
      : ctx.ui.theme.style(" auto ", { fg: "text", bg: "selectedBg" }));
    if (Boolean(state) === active) return;
    active = Boolean(state);
    const others = pi.getActiveTools().filter((name) => !TOOLS.includes(name));
    pi.setActiveTools(active ? [...others, ...TOOLS] : others);
  };
  const enter = (ctx: ExtensionContext, state: Phase | null) => { pi.appendEntry(STATE, state); sync(ctx); };

  pi.registerCommand("work", {
    description: "Start the workflow (Plan) in place: /work [task or report]",
    handler: async (input, ctx) => {
      const task = await describeTask(ctx.cwd);
      enter(ctx, { mode: "plan", input, task });
      ctx.ui.notify(`Workflow task ${task.id} in ${task.root} (${task.kind === "git" ? "Git" : "non-Git"}, in place).`, "info");
      pi.sendUserMessage(input.trim() ? `Begin Plan.\n\nTask:\n${input}` : "Begin Plan: ask me for the task.");
    },
  });

  pi.registerTool({
    name: "workflow_phase", label: "Workflow phase", defaultActive: false, exposure: "model-only",
    description: "Switch the workflow to another phase in this same session. Input is the absolute plan/report path (or a task for Plan); notes carry concise handoff context, never the transcript. Ends this run; the new phase starts right after with its own instructions.",
    parameters: Type.Object({
      mode: Type.Union(MODES.map((mode) => Type.Literal(mode))),
      input: Type.String({ description: "Absolute plan/report path, or a new task for Plan." }),
      notes: Type.Optional(Type.String({ description: "Short handoff context." })),
    }),
    async execute(_id, { mode, input, notes }, _signal, _update, ctx) {
      const state = current(ctx);
      if (!state) throw new Error("No active workflow; the user starts one with /work.");
      enter(ctx, { mode, input, notes, task: state.task });
      // Phase prompts are injected per run (before_agent_start), so kick off a fresh run.
      pi.sendUserMessage(`Begin ${mode} now; no start confirmation needed.`, { deliverAs: "followUp" });
      return { content: [{ type: "text", text: `Switched to ${mode}; it starts in the next run.` }], details: undefined, terminate: true };
    },
  });

  pi.registerTool({
    name: "workflow_question", label: "Choose a workflow action", defaultActive: false, exposure: "model-only", executionMode: "sequential",
    description: "Ask a finite workflow decision with the native picker. Give context and explicit action labels. Cancellation means wait for chat; don't reopen.",
    parameters: Type.Object({
      question: Type.String({ minLength: 1 }),
      options: Type.Array(Type.String({ minLength: 1 }), { minItems: 2, uniqueItems: true }),
    }),
    async execute(_id, { question, options }, signal, _update, ctx) {
      if (!ctx.hasUI) return { content: [{ type: "text", text: `No UI: ask in chat.\n${question}\n${options.map((o) => `- ${o}`).join("\n")}` }], details: undefined };
      const choice = await ctx.ui.select(question, options, { signal });
      if (choice === undefined) return { content: [{ type: "text", text: "Cancelled; nothing is authorized. Wait for chat." }], details: undefined, terminate: true };
      return { content: [{ type: "text", text: `Selected: ${choice}` }], details: undefined };
    },
  });

  pi.registerTool({
    name: "workflow_exit", label: "Leave the workflow", defaultActive: false, exposure: "model-only",
    description: "End the workflow in this session (badge back to auto). Touches no files and runs no Git commands. Call after Finalize, or when the user asks to leave.",
    parameters: Type.Object({}),
    async execute(_id, _params, _signal, _update, ctx) {
      enter(ctx, null);
      return { content: [{ type: "text", text: "Workflow ended. Changes stay in place for the user." }], details: undefined, terminate: true };
    },
  });

  pi.on("session_start", async (_event, ctx) => sync(ctx));
  pi.on("session_tree", async (_event, ctx) => sync(ctx));
  pi.on("before_agent_start", async (event, ctx) => {
    sync(ctx);
    const state = current(ctx);
    if (!state) return;
    let prompt: string;
    try { prompt = `${read("rules")}\n\n${read(state.mode)}`; }
    catch (error) {
      event.systemPromptOptions.sections.workflow = `Workflow paused: ${String(error)}. Explain the missing file and wait for the user.`;
      return;
    }
    event.systemPromptOptions.sections.workflow = [prompt, guidance(state.task),
      `Phase: ${state.mode}`, `Input: ${state.input || "not supplied, ask the user"}`, ...(state.notes ? [`Handoff notes: ${state.notes}`] : [])].join("\n\n");
  });
}

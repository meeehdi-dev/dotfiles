import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile, access, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { dirname, join, sep } from "node:path";
import { promisify } from "node:util";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

const exec = promisify(execFile);
// Must match [worktrees] directory in ~/.config/herdr/config.toml.
const WORKTREES_DIR = join(homedir(), ".herdr", "worktrees");
const DEFAULT_INCLUDES = ["**/.env", "**/.env.*"];

export function agentName(branch: string): string {
  const slug = (branch.split("/").pop() ?? branch).toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return (/^[a-z]/.test(slug) ? slug : `w-${slug}`).slice(0, 32).replace(/-+$/, "");
}

// Copies gitignored, untracked files (env files by default, or .worktreeinclude globs) from the main checkout.
export async function copyIncludes(repoRoot: string, worktree: string, signal?: AbortSignal): Promise<string[]> {
  const include = await readFile(join(repoRoot, ".worktreeinclude"), "utf8").catch(() => "");
  const patterns = include.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
  const { stdout } = await exec("git", ["ls-files", "-z", "--others", "--ignored", "--exclude-standard", "--",
    ...(patterns.length ? patterns : DEFAULT_INCLUDES).map((p) => `:(glob)${p}`)], { cwd: repoRoot, signal, maxBuffer: 64 << 20 });
  const files = stdout.split("\0").filter((f) => f && !f.endsWith("/") && !f.split("/").includes("node_modules"));
  for (const file of files) {
    await mkdir(dirname(join(worktree, file)), { recursive: true });
    await copyFile(join(repoRoot, file), join(worktree, file));
  }
  return files;
}

// The fork is taken mid-tool-call; providers reject a trailing tool call without a result, so close it out.
export async function forkableCopy(session: string, note: string): Promise<string> {
  const text = (await readFile(session, "utf8")).trimEnd();
  const entries = text.split("\n").map((line) => JSON.parse(line));
  const done = new Set<string>();
  let calls: { id: string; name: string }[] = [];
  for (let i = entries.length - 1; i >= 0; i--) {
    const message = entries[i].type === "message" ? entries[i].message : undefined;
    if (message?.role === "toolResult") done.add(message.toolCallId);
    else if (message?.role === "assistant") {
      calls = (message.content ?? []).filter((c: { type: string; id: string }) => c.type === "toolCall" && !done.has(c.id));
      break;
    } else if (message) break;
  }
  let parentId = entries.at(-1).id;
  const extra = calls.map((call: { id: string; name: string }) => {
    const id = randomBytes(4).toString("hex");
    const entry = { type: "message", id, parentId, timestamp: new Date().toISOString(), message: {
      role: "toolResult", toolCallId: call.id, toolName: call.name, isError: false, timestamp: Date.now(),
      content: [{ type: "text", text: call.name === "spawn_worktree" ? note : "Not run in this fork." }] } };
    parentId = id;
    return JSON.stringify(entry);
  });
  const copy = join(await mkdtemp(join(tmpdir(), "spawn-worktree-")), "session.jsonl");
  await writeFile(copy, [text, ...extra].join("\n") + "\n", { mode: 0o600 });
  return copy;
}

async function herdr(args: string[], signal?: AbortSignal) {
  try {
    const { stdout } = await exec("herdr", args, { signal, maxBuffer: 16 << 20 });
    return JSON.parse(stdout || "{}");
  } catch (error) {
    const err = error as { stderr?: string; message: string };
    throw new Error(`herdr ${args.slice(0, 2).join(" ")} failed: ${err.stderr?.trim() || err.message}`);
  }
}

type Workspace = { workspace_id: string; label: string; worktree?: { repo_name: string; is_linked_worktree: boolean } };

// Resolves a workspace ID, label or repo name to a primary (non-linked) workspace ID.
export function resolveWorkspace(workspaces: Workspace[], query: string): string {
  const primary = workspaces.filter((w) => !w.worktree?.is_linked_worktree);
  const q = query.toLowerCase();
  const byId = primary.find((w) => w.workspace_id === query);
  if (byId) return byId.workspace_id;
  const matches = primary.filter((w) => w.label.toLowerCase() === q || w.worktree?.repo_name.toLowerCase() === q);
  if (matches.length === 1) return matches[0].workspace_id;
  const list = (ws: Workspace[]) => ws.map((w) => `${w.label} (${w.workspace_id})`).join(", ");
  throw new Error(matches.length ? `"${query}" is ambiguous: ${list(matches)}` : `No primary workspace "${query}". Available: ${list(primary)}`);
}

export default function (pi: ExtensionAPI) {
  pi.on("project_trust", async (event) =>
    event.cwd.startsWith(WORKTREES_DIR + sep) ? { trusted: "yes", remember: true } : { trusted: "undecided" });

  pi.registerTool({
    name: "spawn_worktree",
    label: "Spawn Worktree",
    description: "Create a herdr git worktree from a herdr workspace, copy env files, run pnpm install, and start a pi agent there on a fork of the current session, kicked off with the given prompt. Returns immediately after the kickoff is sent.",
    promptSnippet: "Create a herdr worktree and start a forked pi agent in it on a task",
    promptGuidelines: [
      "Use spawn_worktree when the user wants a task carried out in a separate worktree. Pass the source workspace by its herdr label or repo name (no lookup needed), a conventional branch name like feat/<ticket>-<slug>, and a kickoff that states the plan; call it once per repo for multi-repo tasks.",
    ],
    parameters: Type.Object({
      workspace: Type.String({ description: "Source workspace: herdr label, repo name, or ID of the main checkout (e.g. rearview, spk)" }),
      branch: Type.String({ minLength: 1, description: "Branch name to create, e.g. feat/jda-858-siren-check" }),
      label: Type.Optional(Type.String({ description: "Short herdr workspace label" })),
      kickoff: Type.String({ minLength: 1, description: "First prompt for the forked agent: the plan and where to start" }),
    }),
    async execute(_id, { workspace, branch, label, kickoff }, signal, onUpdate, ctx) {
      if (process.env.HERDR_ENV !== "1") throw new Error("spawn_worktree requires running inside herdr");
      const session = ctx.sessionManager.getSessionFile();
      if (!session) throw new Error("spawn_worktree requires a persisted session to fork");
      const progress = (text: string) => onUpdate?.({ content: [{ type: "text", text }], details: undefined });

      const source = resolveWorkspace((await herdr(["workspace", "list"], signal)).result.workspaces, workspace);
      progress(`Creating worktree ${branch}…`);
      const created = (await herdr(["worktree", "create", "--workspace", source, "--branch", branch,
        ...(label ? ["--label", label] : []), "--no-focus"], signal)).result;
      const { checkout_path: path, repo_root: repoRoot, repo_name: repo } = created.workspace.worktree as { checkout_path: string; repo_root: string; repo_name: string };
      const title = label || branch;
      if (!pi.getSessionName()) pi.setSessionName(`${repo}: ${title}`);
      const pane: string = created.root_pane.pane_id;
      const notes: string[] = [];

      progress("Copying env files…");
      try {
        const files = await copyIncludes(repoRoot, path, signal);
        notes.push(`Copied: ${files.join(", ") || "nothing"}`);
      } catch (error) {
        notes.push(`Env copy failed: ${(error as Error).message}`);
      }

      if (await access(join(path, "pnpm-lock.yaml")).then(() => true, () => false)) {
        progress("pnpm install…");
        try {
          await exec("pnpm", ["install", "--frozen-lockfile", "--prefer-offline"], { cwd: path, signal, timeout: 600_000, maxBuffer: 64 << 20 });
          notes.push("pnpm install: ok");
        } catch (error) {
          const err = error as { stderr?: string; message: string };
          notes.push(`pnpm install failed (agent told): ${(err.stderr || err.message).trim().split("\n").slice(-5).join(" | ")}`);
          kickoff += "\n\nNote: `pnpm install --frozen-lockfile --prefer-offline` failed during worktree setup; fix dependencies first.";
        }
      }

      progress("Starting pi…");
      const name = agentName(branch);
      const fork = await forkableCopy(session, `Worktree ready at ${path} on branch ${branch}. You are now the agent running in this worktree; continue from the next message.`);
      try {
        await herdr(["agent", "start", name, "--kind", "pi", "--pane", pane, "--timeout", "60000", "--", "--fork", fork, "--name", title], signal);
      } finally {
        await rm(dirname(fork), { recursive: true, force: true }); // pi copied it into its own session store
      }
      await herdr(["agent", "prompt", name, kickoff], signal);

      return {
        content: [{ type: "text", text: `Spawned agent "${name}" in workspace ${created.workspace.workspace_id} (pane ${pane}) at ${path}.\n${notes.join("\n")}` }],
        details: undefined,
      };
    },
  });
}

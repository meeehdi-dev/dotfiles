import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { lstatSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";
import { SessionManager, type ExtensionCommandContext } from "@earendil-works/pi-coding-agent";

const exec = promisify(execFile);
const METADATA = "workflow-task.json";
type DirectoryTask = { kind: "directory"; id: string; projectKey: string; originalCwd: string; root: string };
type GitTask = {
  kind?: "git";
  id: string; projectKey: string; repository: string; sourceRoot: string; originalCwd: string;
  root: string; branch: string; commit: string;
};
export type Task = GitTask | DirectoryTask;
const paths = ["repository", "sourceRoot", "originalCwd", "root"] as const;
export function task(value: unknown): Task {
  const data = value as GitTask;
  if ((value as DirectoryTask)?.kind === "directory") {
    const directory = value as DirectoryTask;
    if (typeof directory.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(directory.id) ||
        typeof directory.root !== "string" || directory.projectKey !== directoryProjectKey(directory.root) || directory.originalCwd !== directory.root ||
        !isAbsolute(directory.root) || resolve(directory.root) !== directory.root ||
        ["repository", "sourceRoot", "branch", "commit"].some((key) => key in directory)) {
      throw new Error("Invalid non-Git workflow task association; ask for recovery direction.");
    }
    return { kind: "directory", id: directory.id, projectKey: directory.projectKey, originalCwd: directory.originalCwd, root: directory.root };
  }
  if (!data || (data.kind !== undefined && data.kind !== "git") || typeof data.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(data.id) ||
      data.branch !== `pi/${data.id}` || typeof data.projectKey !== "string" || !/^[\w.-]+-[0-9a-f]{12}$/.test(data.projectKey) ||
      typeof data.commit !== "string" || !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(data.commit) ||
      paths.some((key) => typeof data[key] !== "string" || !isAbsolute(data[key]) || resolve(data[key]) !== data[key])) {
    throw new Error("Invalid workflow task association; select the correct task worktree, or ask for legacy-task recovery.");
  }
  return Object.fromEntries([...(data.kind ? ["kind"] : []), "id", "projectKey", ...paths, "branch", "commit"].map((key) => [key, data[key as keyof GitTask]])) as GitTask;
}
export async function git(cwd: string, args: string[], signal?: AbortSignal) {
  const result = await exec("git", ["--no-optional-locks", "-C", cwd, ...args], { encoding: "utf8", maxBuffer: 1024 * 1024, signal, env: { ...process.env, LC_ALL: "C" } });
  return result.stdout.endsWith("\n") ? result.stdout.slice(0, -1) : result.stdout;
}
async function identity(cwd: string, signal?: AbortSignal) {
  const root = realpathSync(await git(cwd, ["rev-parse", "--show-toplevel"], signal));
  const repository = realpathSync(await git(cwd, ["rev-parse", "--path-format=absolute", "--git-common-dir"], signal));
  const admin = realpathSync(await git(cwd, ["rev-parse", "--absolute-git-dir"], signal));
  return { root, repository, admin };
}
function directoryProjectKey(root: string) {
  return `${basename(root).replace(/[^\w.-]/g, "-")}-${createHash("sha256").update(root).digest("hex").slice(0, 12)}`;
}

// Only Git's explicit non-repository result permits in-place entry, never a broken .git marker.
export async function nonGit(cwd: string, signal?: AbortSignal) {
  try { await git(cwd, ["rev-parse", "--show-toplevel"], signal); return false; }
  catch (error) {
    const failure = error as { code?: number; stderr?: string };
    const message = failure.stderr ?? "";
    if (failure.code !== 128 || (!/^fatal: not a git repository \(or any of the parent directories\): \.git\s*$/.test(message) &&
        !/^fatal: not a git repository \(or any parent up to mount point [^\n]+\)\nStopping at filesystem boundary \(GIT_DISCOVERY_ACROSS_FILESYSTEM not set\)\.\s*$/.test(message))) throw error;
    let current = realpathSync(cwd);
    if (!statSync(current).isDirectory()) throw new Error(`Not a directory: ${current}`);
    while (true) {
      try { lstatSync(join(current, ".git")); throw new Error(`Broken Git metadata at ${current}; ask for recovery, not in-place fallback.`); }
      catch (marker) { if ((marker as NodeJS.ErrnoException).code !== "ENOENT") throw marker; }
      const parent = dirname(current);
      if (parent === current) break;
      current = parent;
    }
    signal?.throwIfAborted();
    return true;
  }
}
export async function association(cwd: string, expected?: Task, signal?: AbortSignal): Promise<Task | undefined> {
  if (expected) expected = task(expected);
  const outside = await nonGit(cwd, signal);
  if (expected?.kind === "directory") {
    const location = relative(expected.root, realpathSync(cwd));
    if (!outside || realpathSync(expected.root) !== expected.root || !statSync(expected.root).isDirectory() ||
        location === ".." || location.startsWith(`..${sep}`) || isAbsolute(location)) {
      throw new Error(`Non-Git workflow directory mismatch or repository appeared at ${cwd}; ask for direction before continuing.`);
    }
    return expected;
  }
  if (outside) {
    if (expected) throw new Error(`Expected managed Git task at ${cwd}; ask for recovery before continuing.`);
    return;
  }
  const info = await identity(cwd, signal);
  let value: unknown;
  try { value = JSON.parse(readFileSync(join(info.admin, METADATA), "utf8")); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT" && !expected) return;
    throw new Error(`Cannot read workflow task association at ${join(info.admin, METADATA)}: ${String(error)}`);
  }
  const data = task(value);
  if (data.kind === "directory") throw new Error("Git metadata cannot describe a non-Git task.");
  if (data.root !== info.root || data.repository !== info.repository ||
      await git(cwd, ["symbolic-ref", "--quiet", "--short", "HEAD"], signal) !== data.branch ||
      (expected && JSON.stringify(data) !== JSON.stringify(task(expected)))) {
    throw new Error(`Workflow task/repository/branch mismatch at ${cwd}; restore ${data.branch} in ${data.root} before continuing.`);
  }
  const source = await identity(data.originalCwd, signal);
  const launch = relative(data.sourceRoot, realpathSync(data.originalCwd));
  if (source.root !== data.sourceRoot || source.repository !== data.repository ||
      !statSync(data.originalCwd).isDirectory() || launch === ".." || launch.startsWith(`..${sep}`) || isAbsolute(launch)) {
    throw new Error(`Original workflow directory/repository mismatch: ${data.originalCwd}; ask for recovery before continuing.`);
  }
  await git(cwd, ["cat-file", "-e", `${data.commit}^{commit}`], signal);
  return data;
}

export async function workspace(ctx: ExtensionCommandContext, mode: string, expected?: Task) {
  const existing = await association(ctx.cwd, expected, ctx.signal);
  if (existing) return { task: existing, cwd: realpathSync(ctx.cwd) };
  if (await nonGit(ctx.cwd, ctx.signal)) {
    const root = realpathSync(ctx.cwd);
    const data: DirectoryTask = { kind: "directory", id: randomUUID(), projectKey: directoryProjectKey(root), originalCwd: root, root };
    return { task: data, cwd: root };
  }
  if (mode !== "plan") throw new Error("No managed task worktree. Enter the existing task worktree and retry; for a new task start /work. Legacy tasks need explicit user direction, not automatic migration.");
  if (!ctx.sessionManager.getSessionFile()) throw new Error("Workspace switching needs a persistent session. Relaunch Pi in persistent mode and run /work; no worktree was created.");
  const source = await identity(ctx.cwd, ctx.signal);
  const originalCwd = realpathSync(ctx.cwd);
  const commit = await git(ctx.cwd, ["rev-parse", "--verify", "HEAD^{commit}"], ctx.signal);
  const branch = await git(ctx.cwd, ["branch", "--show-current"], ctx.signal) || "detached HEAD";
  ctx.ui.notify(`New task starts at ${branch} (${commit}) from ${source.root}.`, "info");
  const pending = await git(ctx.cwd, ["status", "--porcelain=v1", "--untracked-files=all"], ctx.signal);
  if (pending) {
    const proceed = "Proceed from committed files only";
    if (!ctx.hasUI) throw new Error("Source has staged, unstaged, or untracked changes. No task created. Use interactive/RPC /work to choose committed files only, or enter an existing task worktree; pending files will not be copied.");
    const choice = await ctx.ui.select(`Source has pending changes. Start from ${branch} (${commit})? Pending files stay in ${source.root}; nothing is copied, stashed, or staged.`, [proceed, "Cancel"], { signal: ctx.signal });
    ctx.signal?.throwIfAborted();
    if (choice !== proceed) throw new Error("Task creation cancelled; no phase started. Continue in chat when ready.");
  }
  ctx.signal?.throwIfAborted();
  const id = randomUUID();
  const project = basename(source.repository) === ".git" ? basename(dirname(source.repository)) : basename(source.repository);
  const projectKey = `${project.replace(/[^\w.-]/g, "-")}-${createHash("sha256").update(source.repository).digest("hex").slice(0, 12)}`;
  const root = join(homedir(), ".pi", "worktrees", projectKey, id);
  const data: GitTask = { id, projectKey, repository: source.repository, sourceRoot: source.root, originalCwd, root, branch: `pi/${id}`, commit };
  mkdirSync(dirname(root), { recursive: true });
  try {
    await git(source.root, ["worktree", "add", "-b", data.branch, root, commit], ctx.signal);
    const info = await identity(root, ctx.signal);
    data.root = info.root;
    writeFileSync(join(info.admin, METADATA), `${JSON.stringify(data)}\n`, { flag: "wx", mode: 0o600 });
    const cwd = resolve(root, relative(source.root, originalCwd));
    try {
      if (!statSync(cwd).isDirectory()) throw new Error("not a directory");
      const location = relative(data.root, realpathSync(cwd));
      if (location === ".." || location.startsWith(`..${sep}`) || isAbsolute(location)) throw new Error("directory escapes the task worktree");
    }
    catch {
      throw new Error(`Launch subdirectory is absent from committed files: ${cwd}. Ask the user whether to enter the task root or select another directory; do not silently change context.`);
    }
    return { task: data, cwd: realpathSync(cwd) };
  } catch (error) {
    throw new Error(`${String(error)}\nSetup may have retained branch ${data.branch} and worktree ${root}. No rollback performed; inspect them before recovery. Source checkout was not changed.`);
  }
}

// Custom entries alone do not flush a new SessionManager: serialize its public JSONL contract once.
export function entrySession(cwd: string, state: unknown, ctx: ExtensionCommandContext, notice = `Task workspace: ${cwd}. Fresh workflow session; no source conversation was copied.`) {
  const manager = SessionManager.create(cwd, ctx.sessionManager.getSessionDir());
  if (ctx.model) manager.appendModelChange(ctx.model.provider, ctx.model.id);
  if (ctx.thinkingLevel) manager.appendThinkingLevelChange(ctx.thinkingLevel);
  if (state !== undefined) manager.appendCustomEntry("workflow-phase", state);
  // Pi restores model/thinking only when the session has context, not just settings entries.
  manager.appendCustomMessageEntry("workflow-notice", notice, true);
  const file = manager.getSessionFile()!;
  writeFileSync(file, [manager.getHeader(), ...manager.getEntries()].map((entry) => JSON.stringify(entry)).join("\n") + "\n", { flag: "wx", mode: 0o600 });
  return file;
}

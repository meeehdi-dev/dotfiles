#!/usr/bin/env node
// capture --root /task --output /artifacts/new.json [--exclude path] [--file path]
// compare --root /task --evidence /artifacts/prior.json [same --exclude/--file scope]
// Exit 2 means error/uncertainty; changed paths alone are not an error or a review verdict.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { closeSync, constants, fstatSync, lstatSync, openSync, readFileSync, readlinkSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

const fail = (message) => { throw new Error(message); };
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const inside = (root, path) => path === root || (!relative(root, path).startsWith("../") && !isAbsolute(relative(root, path)));
function paths(values) {
  if (!Array.isArray(values) || values.some((p) => typeof p !== "string" || !p || p.includes("\0") || isAbsolute(p) || p.split("/").some((s) => !s || s === "." || s === ".."))) fail("Scope paths must be root-relative file paths");
  return [...new Set(values)].sort();
}
function options() {
  const [command, ...args] = process.argv.slice(2);
  if (!["capture", "compare"].includes(command)) fail("Expected capture or compare");
  const opts = { command, exclude: [], file: [] };
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, ""), value = args[i + 1];
    if (args[i] !== `--${key}` || !["root", "output", "evidence", "exclude", "file"].includes(key) || value === undefined) fail("Invalid arguments");
    if (Array.isArray(opts[key])) opts[key].push(value);
    else if (opts[key] !== undefined) fail(`Duplicate --${key}`);
    else opts[key] = value;
  }
  if (!opts.root || !isAbsolute(opts.root)) fail("An explicit absolute --root is required");
  if (command === "capture" ? (!opts.output || opts.evidence) : (!opts.evidence || opts.output)) fail("capture requires --output; compare requires --evidence");
  opts.root = realpathSync(opts.root);
  if (!lstatSync(opts.root).isDirectory()) fail("Root must be a directory");
  opts.exclude = paths(opts.exclude);
  opts.file = paths(opts.file);
  return opts;
}
function git(root, ...args) {
  const bytes = execFileSync("git", ["-C", root, ...args], { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" } });
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}
function fingerprint(root, path, submodules, uncertainty) {
  try {
    if (submodules.has(path)) throw new Error("submodule internals unverified");
    const parts = path.split("/");
    for (let i = 1; i < parts.length; i++) {
      if (lstatSync(join(root, ...parts.slice(0, i))).isSymbolicLink()) throw new Error("symlink ancestor; contents not read");
    }
    const full = join(root, path), stat = lstatSync(full);
    if (stat.isSymbolicLink()) {
      uncertainty.push(`${path}: symlink target contents unverified`);
      return { type: "symlink", hash: hash(readlinkSync(full, { encoding: "buffer" })), executable: false };
    }
    if (!stat.isFile()) throw new Error("unsupported file type");
    const fd = openSync(full, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const opened = fstatSync(fd);
      if (stat.dev !== opened.dev || stat.ino !== opened.ino || !inside(root, realpathSync(dirname(full)))) throw new Error("file changed before reading");
      const bytes = readFileSync(fd);
      const after = fstatSync(fd);
      if (stat.size !== after.size || stat.mtimeMs !== after.mtimeMs || stat.ctimeMs !== after.ctimeMs) throw new Error("file changed while reading");
      return { type: "file", hash: hash(bytes), executable: Boolean(stat.mode & 0o111) };
    } finally { closeSync(fd); }
  } catch (error) {
    if (error.code === "ENOENT") return { type: "missing" };
    uncertainty.push(`${path}: ${error.code ?? error.message}`);
    return { type: "unverified" };
  }
}
function capture(opts) {
  const { root, exclude, file } = opts;
  let top;
  try { top = git(root, "rev-parse", "--show-toplevel").trim(); }
  catch (error) { if (error.status !== 128 || !String(error.stderr).includes("not a git repository")) throw error; }
  const kind = top ? "git" : "directory";
  if (top && realpathSync(top) !== root) fail("--root must be the Git task root, not a subdirectory");
  if (kind === "git" && file.length) fail("--file is only for non-Git roots");
  if (kind === "directory" && !file.length) fail("Non-Git roots require explicit --file scope");
  let revision = null, inventory = file, submodules = new Set();
  if (top) {
    try { revision = git(root, "rev-parse", "--verify", "-q", "HEAD^{commit}").trim(); }
    catch (error) {
      if (error.status !== 1) throw error;
      // Only a symbolic HEAD with a missing ref is unborn; broken refs remain errors.
      const ref = git(root, "symbolic-ref", "-q", "HEAD").trim();
      try { git(root, "show-ref", "--verify", "--quiet", ref); fail("Cannot read HEAD commit"); }
      catch (error) { if (error.status !== 1) throw error; }
    }
    const tracked = git(root, "ls-files", "--stage", "-z").split("\0").filter(Boolean);
    inventory = tracked.map((entry) => {
      const tab = entry.indexOf("\t"), path = entry.slice(tab + 1);
      if (entry.startsWith("160000 ")) submodules.add(path);
      return path;
    });
    inventory.push(...git(root, "ls-files", "--others", "--exclude-standard", "-z").split("\0").filter(Boolean));
  }
  const uncertainty = [], entries = [];
  for (const path of paths(inventory)) {
    if (exclude.some((p) => path === p || path.startsWith(`${p}/`))) continue;
    entries.push({ path, ...fingerprint(root, path, submodules, uncertainty) });
  }
  return { version: 1, root, kind, revision, exclusions: exclude, files: file, exhaustive: kind === "git", entries, uncertainty };
}
function validate(prior, current) {
  if (!prior || prior.version !== 1 || prior.root !== current.root || prior.kind !== current.kind || prior.exhaustive !== current.exhaustive || JSON.stringify(prior.exclusions) !== JSON.stringify(current.exclusions) || JSON.stringify(prior.files) !== JSON.stringify(current.files)) fail("Unsupported evidence or mismatched root/scope");
  if (prior.kind === "git" ? prior.revision !== null && !/^[a-f0-9]{40,64}$/.test(prior.revision) : prior.revision !== null) fail("Invalid evidence revision");
  if (!Array.isArray(prior.entries) || !Array.isArray(prior.uncertainty) || prior.uncertainty.some((s) => typeof s !== "string")) fail("Malformed evidence");
  const names = paths(prior.entries.map((e) => e?.path));
  if (names.length !== prior.entries.length || JSON.stringify(names) !== JSON.stringify(prior.entries.map((e) => e.path))) fail("Invalid evidence inventory");
  for (const e of prior.entries) {
    if (!["file", "symlink", "missing", "unverified"].includes(e.type) || (["file", "symlink"].includes(e.type) && (!/^[a-f0-9]{64}$/.test(e.hash) || typeof e.executable !== "boolean"))) fail("Malformed fingerprint");
    if (current.exclusions.some((p) => e.path === p || e.path.startsWith(`${p}/`)) || (current.kind === "directory" && !current.files.includes(e.path))) fail("Evidence inventory outside scope");
    if (["symlink", "unverified"].includes(e.type) && !prior.uncertainty.length) fail("Missing uncertainty in evidence");
  }
  if (current.kind === "directory" && JSON.stringify(names) !== JSON.stringify(current.entries.map((e) => e.path))) fail("Incomplete non-Git evidence inventory");
}
try {
  const opts = options();
  let prior;
  if (opts.command === "compare") prior = JSON.parse(readFileSync(opts.evidence, "utf8"));
  const current = capture(opts);
  if (opts.command === "capture") {
    if (!isAbsolute(opts.output)) fail("--output must be absolute");
    const output = join(realpathSync(dirname(opts.output)), relative(dirname(opts.output), resolve(opts.output)));
    if (inside(opts.root, output)) fail("Evidence output must be outside task source");
    writeFileSync(output, `${JSON.stringify(current, null, 2)}\n`, { flag: "wx", mode: 0o600 });
    console.log(JSON.stringify({ evidence: output, uncertainty: current.uncertainty, exhaustive: current.exhaustive }));
  } else {
    validate(prior, current);
    const before = new Map(prior.entries.map((e) => [e.path, e]));
    const after = new Map(current.entries.map((e) => [e.path, e]));
    const result = { unchanged: [], added: [], modified: [], deleted: [], uncertainty: [...new Set([...prior.uncertainty, ...current.uncertainty])], exhaustive: current.exhaustive, previousRevision: prior.revision, revision: current.revision };
    for (const path of [...new Set([...before.keys(), ...after.keys()])].sort()) {
      const a = before.get(path), b = after.get(path);
      const present = (e) => e && e.type !== "missing";
      const same = (!present(a) && !present(b)) || (a?.type === b?.type && a?.hash === b?.hash && a?.executable === b?.executable);
      const category = !present(a) && present(b) ? "added" : present(a) && !present(b) ? "deleted" : same ? "unchanged" : "modified";
      result[category].push(path);
    }
    console.log(JSON.stringify(result));
    if (result.uncertainty.length) process.exitCode = 2;
  }
  if (current.uncertainty.length) process.exitCode = 2;
} catch (error) {
  console.error(JSON.stringify({ error: error.message, uncertainty: ["Evidence unavailable or invalid; recheck affected coverage"] }));
  process.exitCode = 2;
}

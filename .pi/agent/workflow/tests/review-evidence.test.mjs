import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync, execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const source = fileURLToPath(new URL("../../../../.claude/workflow/review-evidence.mjs", import.meta.url));
const pi = fileURLToPath(new URL("../review-evidence.mjs", import.meta.url));
function fixture(t, git = false) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "review-evidence-")));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const root = join(dir, "task");
  mkdirSync(root);
  const runGit = (...args) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8", env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" } });
  if (git) runGit("init", "-q");
  const put = (path, content = path) => writeFileSync(join(root, path), content);
  const commit = () => { runGit("add", "."); runGit("-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", "commit", "-qm", "fixture"); };
  const invoke = (entry, args, status = 0) => {
    const result = spawnSync(process.execPath, [entry, ...args], { encoding: "utf8" });
    assert.equal(result.status, status, result.stderr || result.stdout);
    return JSON.parse(result.stdout || result.stderr);
  };
  const capture = (name, scope = [], entry = source, status = 0) => {
    const output = join(dir, `${name}.json`);
    invoke(entry, ["capture", "--root", root, "--output", output, ...scope], status);
    return output;
  };
  const compare = (evidence, scope = [], entry = source, status = 0) => invoke(entry, ["compare", "--root", root, "--evidence", evidence, ...scope], status);
  return { dir, root, runGit, put, commit, invoke, capture, compare };
}

test("Git evidence detects a small follow-up and unrelated changes without touching source/index", (t) => {
  const f = fixture(t, true);
  for (const name of ["stable", "modify", "delete", "space name", "user-work", "executable"]) f.put(name);
  f.put(".gitignore", "ignored\n"); f.commit();
  f.put("untracked stable"); f.put("untracked delete"); f.put("untracked modify"); f.put("ignored");
  f.put("user-work", "pre-existing user change");
  const scope = ["--exclude", "user-work"];
  const before = f.runGit("status", "--porcelain=v1", "--untracked-files=all");
  const index = readFileSync(join(f.root, ".git/index"));
  const evidence = f.capture("initial", scope);
  const repeat = f.capture("repeat", scope, pi);
  assert.equal(readFileSync(evidence, "utf8"), readFileSync(repeat, "utf8"));
  const initial = f.compare(evidence, scope);
  assert.deepEqual(initial.added, []); assert.deepEqual(initial.modified, []); assert.deepEqual(initial.deleted, []);
  assert.ok(initial.unchanged.includes("space name"));
  assert.ok(!initial.unchanged.includes("user-work")); assert.ok(!initial.unchanged.includes("ignored"));
  assert.equal(f.runGit("status", "--porcelain=v1", "--untracked-files=all"), before);
  assert.deepEqual(readFileSync(join(f.root, ".git/index")), index);
  assert.equal(readFileSync(join(f.root, "user-work"), "utf8"), "pre-existing user change");

  f.put("modify", "small correction"); f.put("untracked modify", "changed");
  f.put("unrelated new file"); f.put("tracked new"); f.runGit("add", "tracked new");
  chmodSync(join(f.root, "executable"), 0o755);
  unlinkSync(join(f.root, "delete")); unlinkSync(join(f.root, "untracked delete"));
  f.put("user-work", "still excluded");
  const changedStatus = f.runGit("status", "--porcelain=v1", "--untracked-files=all");
  const changedIndex = readFileSync(join(f.root, ".git/index"));
  const result = f.compare(evidence, scope, pi);
  assert.deepEqual(result.added, ["tracked new", "unrelated new file"]);
  assert.deepEqual(result.modified, ["executable", "modify", "untracked modify"]);
  assert.deepEqual(result.deleted, ["delete", "untracked delete"]);
  assert.deepEqual(result.uncertainty, []);
  assert.equal(f.runGit("status", "--porcelain=v1", "--untracked-files=all"), changedStatus);
  assert.deepEqual(readFileSync(join(f.root, ".git/index")), changedIndex);
  const next = f.capture("next", scope);
  assert.deepEqual(f.compare(next, scope).modified, []);
});

test("unborn Git evidence survives corrections and the first commit without hiding broken HEAD", (t) => {
  const f = fixture(t, true);
  f.put("implementation", "initial");
  const head = readFileSync(join(f.root, ".git/HEAD"), "utf8");
  const status = f.runGit("status", "--porcelain=v1", "--untracked-files=all");
  const evidence = f.capture("unborn");
  assert.equal(JSON.parse(readFileSync(evidence, "utf8")).revision, null);
  assert.equal(readFileSync(evidence, "utf8"), readFileSync(f.capture("unborn-pi", [], pi), "utf8"));
  const initial = f.compare(evidence, [], pi);
  assert.deepEqual(initial.unchanged, ["implementation"]);
  assert.equal(initial.previousRevision, null); assert.equal(initial.revision, null);
  assert.deepEqual(initial.uncertainty, []);
  assert.equal(f.runGit("status", "--porcelain=v1", "--untracked-files=all"), status);
  assert.equal(readFileSync(join(f.root, ".git/HEAD"), "utf8"), head);
  assert.equal(existsSync(join(f.root, ".git/index")), false);

  f.put("implementation", "correction");
  assert.deepEqual(f.compare(evidence).modified, ["implementation"]);
  const corrected = f.capture("corrected", [], pi);
  assert.equal(readFileSync(join(f.root, "implementation"), "utf8"), "correction");
  assert.equal(readFileSync(join(f.root, ".git/HEAD"), "utf8"), head);
  assert.equal(existsSync(join(f.root, ".git/index")), false);
  f.commit(); // Fixture-only Git writes, never the task repository.
  const revision = f.runGit("rev-parse", "HEAD").trim();
  const index = readFileSync(join(f.root, ".git/index"));
  const committedStatus = f.runGit("status", "--porcelain=v1");
  const committed = f.compare(corrected, [], pi);
  assert.equal(committed.previousRevision, null); assert.equal(committed.revision, revision);
  assert.deepEqual(committed.unchanged, ["implementation"]);
  assert.deepEqual(committed.modified, []); assert.deepEqual(committed.uncertainty, []);
  assert.deepEqual(f.compare(evidence).modified, ["implementation"]);
  assert.equal(JSON.parse(readFileSync(f.capture("committed"), "utf8")).revision, revision);
  assert.deepEqual(readFileSync(join(f.root, ".git/index")), index);
  assert.equal(f.runGit("status", "--porcelain=v1"), committedStatus);

  const invalid = join(f.dir, "invalid-revision.json");
  writeFileSync(invalid, readFileSync(evidence, "utf8").replace('"revision": null', '"revision": "bad"'));
  assert.match(f.compare(invalid, [], source, 2).error, /Invalid evidence revision/);
  const ref = f.runGit("symbolic-ref", "HEAD").trim();
  writeFileSync(join(f.root, ".git", ref), `${"0".repeat(40)}\n`);
  assert.ok(f.invoke(source, ["capture", "--root", f.root, "--output", join(f.dir, "broken.json")], 2).error);
  assert.equal(existsSync(join(f.dir, "broken.json")), false);
  assert.ok(f.compare(evidence, [], pi, 2).error);
  writeFileSync(join(f.root, ".git/HEAD"), `${"0".repeat(40)}\n`);
  assert.ok(f.compare(evidence, [], source, 2).error);
});

test("non-Git inventory is explicit and non-exhaustive, including missing files", (t) => {
  const f = fixture(t);
  f.put("space name"); f.put("not reviewed");
  const scope = ["--file", "space name", "--file", "later"];
  const evidence = f.capture("plain", scope);
  assert.equal(f.compare(evidence, scope).exhaustive, false);
  assert.deepEqual(f.compare(evidence, scope).unchanged, ["later", "space name"]);
  f.put("later"); unlinkSync(join(f.root, "space name")); f.put("not reviewed", "not discovered");
  const result = f.compare(evidence, scope);
  assert.deepEqual(result.added, ["later"]); assert.deepEqual(result.deleted, ["space name"]);
  assert.deepEqual(result.modified, []);
  assert.match(f.invoke(source, ["capture", "--root", f.root, "--output", join(f.dir, "no-scope.json")], 2).error, /explicit --file/);
});

test("symlinks record identity, never external content; ancestor links and unsupported types are uncertain", (t) => {
  const f = fixture(t);
  mkdirSync(join(f.dir, "outside")); writeFileSync(join(f.dir, "outside/secret"), "do not copy");
  symlinkSync(join(f.dir, "outside"), join(f.root, "boundary"));
  mkdirSync(join(f.root, "folder"));
  const scope = ["--file", "boundary", "--file", "boundary/secret", "--file", "folder"];
  const evidence = f.capture("links", scope, source, 2);
  const manifest = JSON.parse(readFileSync(evidence, "utf8"));
  assert.equal(manifest.entries[0].type, "symlink");
  assert.equal(manifest.entries[1].type, "unverified");
  assert.equal(manifest.entries[2].type, "unverified");
  assert.ok(!readFileSync(evidence, "utf8").includes("do not copy"));
  writeFileSync(join(f.dir, "outside/secret"), "changed externally");
  assert.equal(f.compare(evidence, scope, source, 2).uncertainty.length, 3);
  unlinkSync(join(f.root, "boundary")); symlinkSync("elsewhere", join(f.root, "boundary"));
  assert.ok(f.compare(evidence, scope, source, 2).modified.includes("boundary"));
});

test("invalid evidence/root/scope and unsafe output cannot produce clean evidence or overwrite files", (t) => {
  const f = fixture(t);
  f.put("a");
  const scope = ["--file", "a"], evidence = f.capture("valid", scope);
  const original = readFileSync(evidence, "utf8");
  f.invoke(source, ["capture", "--root", f.root, "--output", evidence, ...scope], 2);
  assert.equal(readFileSync(evidence, "utf8"), original);
  for (const output of [join(f.root, "new.json"), join(f.root, "a")]) {
    assert.match(f.invoke(source, ["capture", "--root", f.root, "--output", output, ...scope], 2).error, /outside task source/);
  }
  symlinkSync(f.root, join(f.dir, "alias"));
  assert.match(f.invoke(source, ["capture", "--root", f.root, "--output", join(f.dir, "alias/new.json"), ...scope], 2).error, /outside task source/);
  assert.equal(readFileSync(join(f.root, "a"), "utf8"), "a");
  const invalid = join(f.dir, "invalid.json");
  for (const content of ["{", JSON.stringify({}), original.replace(f.root, join(f.dir, "wrong-root")), original.replace('"version": 1', '"version": 2'), original.replace(/"hash": "[a-f0-9]+"/, '"hash": "bad"')]) {
    writeFileSync(invalid, content);
    assert.ok(f.compare(invalid, scope, source, 2).error);
  }
  assert.ok(f.compare(evidence, ["--file", "other"], source, 2).error);
  assert.ok(f.compare(join(f.dir, "missing.json"), scope, source, 2).error);
  f.invoke(source, ["capture", "--root", ".", "--output", join(f.dir, "relative.json"), ...scope], 2);
  f.invoke(source, ["capture", "--root", f.root, "--output", join(f.dir, "escape.json"), "--file", "../outside"], 2);
});

test("Git submodule internals remain explicitly unverified", (t) => {
  const f = fixture(t, true);
  f.put("a"); f.commit();
  f.runGit("update-index", "--add", "--cacheinfo", `160000,${f.runGit("rev-parse", "HEAD").trim()},module`);
  const evidence = f.capture("submodule", [], source, 2);
  const result = f.compare(evidence, [], source, 2);
  assert.ok(result.uncertainty.some((s) => s.includes("module: submodule internals unverified")));
});

test("both source aliases work through disposable installed-style workflow links", (t) => {
  const f = fixture(t);
  f.put("a"); const scope = ["--file", "a"];
  for (const [name, entry] of [["claude", source], ["pi", pi]]) {
    const config = join(f.dir, name); mkdirSync(config);
    symlinkSync(join(entry, ".."), join(config, "workflow"));
    const installed = join(config, "workflow/review-evidence.mjs");
    const evidence = f.capture(name, scope, installed);
    assert.deepEqual(f.compare(evidence, scope, installed).unchanged, ["a"]);
  }
});

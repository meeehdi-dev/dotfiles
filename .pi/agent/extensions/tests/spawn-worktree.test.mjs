import assert from "node:assert/strict";
import { test } from "node:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const install = join(homedir(), ".pi/agent/install");
const piRoot = process.env.PI_TEST_PACKAGE_ROOT ?? join(install, "releases", readFileSync(join(install, "current-version"), "utf8").trim(), "node_modules/@earendil-works/pi-coding-agent");
const piRequire = createRequire(join(piRoot, "package.json"));
const jiti = piRequire("jiti").createJiti(import.meta.url, { alias: {
  "@earendil-works/pi-coding-agent": join(piRoot, "dist/index.js"),
  typebox: piRequire.resolve("typebox"),
} });
const mod = await jiti.import(new URL("../spawn-worktree.ts", import.meta.url).pathname);

test("agentName fits herdr naming rules", () => {
  assert.equal(mod.agentName("feat/JDA-858_siren check"), "jda-858_siren-check");
  assert.equal(mod.agentName("fix/858-x"), "w-858-x");
  assert.match(mod.agentName("feat/" + "a".repeat(50)), /^[a-z][a-z0-9_-]{0,31}$/);
});

function repo(files) {
  const dir = mkdtempSync(join(tmpdir(), "spawn-wt-"));
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(join(dir, path, ".."), { recursive: true });
    writeFileSync(join(dir, path), body);
  }
  execFileSync("git", ["init", "-q"], { cwd: dir });
  return dir;
}

test("copies ignored env files by default, skipping tracked files and node_modules", async () => {
  const src = repo({
    ".gitignore": ".env*\nnode_modules\nsecret.json\n",
    ".env": "A=1", "app/.env.local": "B=2", "node_modules/x/.env": "no", "secret.json": "{}", ".env.example": "tracked",
  });
  execFileSync("git", ["add", "-f", ".gitignore", ".env.example"], { cwd: src });
  const dst = mkdtempSync(join(tmpdir(), "spawn-wt-dst-"));
  try {
    const files = await mod.copyIncludes(src, dst);
    assert.deepEqual(files.sort(), [".env", "app/.env.local"]);
    assert.equal(readFileSync(join(dst, "app/.env.local"), "utf8"), "B=2");
    assert.equal(existsSync(join(dst, "secret.json")), false);
  } finally { rmSync(src, { recursive: true }); rmSync(dst, { recursive: true }); }
});

test(".worktreeinclude overrides defaults", async () => {
  const src = repo({ ".gitignore": ".env\nsecret.json\n", ".env": "A=1", "secret.json": "{}", ".worktreeinclude": "# comment\nsecret.json\n" });
  const dst = mkdtempSync(join(tmpdir(), "spawn-wt-dst-"));
  try {
    assert.deepEqual(await mod.copyIncludes(src, dst), ["secret.json"]);
  } finally { rmSync(src, { recursive: true }); rmSync(dst, { recursive: true }); }
});

test("forkableCopy closes dangling tool calls of the last assistant message", async () => {
  const dir = mkdtempSync(join(tmpdir(), "spawn-wt-sess-"));
  const session = join(dir, "s.jsonl");
  const lines = [
    { type: "session", id: "s" },
    { type: "message", id: "a1", message: { role: "assistant", content: [{ type: "toolCall", id: "t1", name: "bash" }, { type: "toolCall", id: "t2", name: "spawn_worktree" }] } },
    { type: "message", id: "r1", parentId: "a1", message: { role: "toolResult", toolCallId: "t1", toolName: "bash", content: [] } },
  ];
  writeFileSync(session, lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
  try {
    const copy = await mod.forkableCopy(session, "ready");
    const out = readFileSync(copy, "utf8").trim().split("\n").map((l) => JSON.parse(l));
    assert.equal(out.length, 4);
    assert.equal(out[3].parentId, "r1");
    assert.equal(out[3].message.toolCallId, "t2");
    assert.equal(out[3].message.content[0].text, "ready");
    rmSync(join(copy, ".."), { recursive: true });
    // Nothing dangling: copy is unchanged.
    writeFileSync(session, lines.slice(0, 1).map((l) => JSON.stringify(l)).join("\n") + "\n");
    const clean = await mod.forkableCopy(session, "ready");
    assert.equal(readFileSync(clean, "utf8").trim().split("\n").length, 1);
    rmSync(join(clean, ".."), { recursive: true });
  } finally { rmSync(dir, { recursive: true }); }
});

test("resolveWorkspace matches id, label or repo name among primary workspaces", () => {
  const ws = [
    { workspace_id: "w1", label: "rearview" },
    { workspace_id: "w2", label: "lvmh-jardin", worktree: { repo_name: "hld-jardin", is_linked_worktree: false } },
    { workspace_id: "w3", label: "jda-858", worktree: { repo_name: "hld-jardin", is_linked_worktree: true } },
    { workspace_id: "w4", label: "dup" }, { workspace_id: "w5", label: "Dup" },
  ];
  assert.equal(mod.resolveWorkspace(ws, "w2"), "w2");
  assert.equal(mod.resolveWorkspace(ws, "Rearview"), "w1");
  assert.equal(mod.resolveWorkspace(ws, "hld-jardin"), "w2");
  assert.throws(() => mod.resolveWorkspace(ws, "jda-858"), /No primary workspace/);
  assert.throws(() => mod.resolveWorkspace(ws, "w3"), /No primary workspace/);
  assert.throws(() => mod.resolveWorkspace(ws, "dup"), /ambiguous/);
});

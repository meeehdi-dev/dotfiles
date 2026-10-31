import assert from "node:assert/strict";
import { test } from "node:test";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

const install = join(homedir(), ".pi/agent/install");
const piRoot = process.env.PI_TEST_PACKAGE_ROOT ?? join(install, "releases", readFileSync(join(install, "current-version"), "utf8").trim(), "node_modules/@earendil-works/pi-coding-agent");
const { createJiti } = await import(pathToFileURL(join(piRoot, "../../jiti/lib/jiti.mjs")));
const { UIServer } = await createJiti(import.meta.url).import(fileURLToPath(new URL("../../extensions/workflow/ui-server.ts", import.meta.url)));
const idle = "setInterval(() => {}, 1000);";
const cwd = tmpdir();
function server(t, startup = 1500) { const s = new UIServer(startup, 80, 100); t.after(() => s.stop()); return s; }
const start = (s, script, signal) => s.start(process.execPath, ["-e", script], cwd, signal);

// Synthetic children emit text only: no HTTP listener, browser, provider or real project dev command.
test("split colored output preserves actual alternate port, route, query and fragment", async (t) => {
  const s = server(t);
  const status = await start(s, `process.stdout.write('\\x1b[32mhttp://local'); setTimeout(() => process.stdout.write('host:49873/route?q=yes#part\\x1b[0m\\n'), 30); ${idle}`);
  assert.equal(status.url, "http://localhost:49873/route?q=yes#part");
  assert.equal(status.running, true);
  await assert.rejects(() => start(s, idle), /already owned/);
  await s.stop(); await s.stop();
  assert.equal(s.status().owned, false);
});

for (const stream of ["stdout", "stderr"]) test(`continuous unrelated ${stream} logs do not delay a complete URL`, async (t) => {
  const s = server(t);
  const status = await start(s, `console.log('http://localhost:49882/ready'); setInterval(() => process.${stream}.write('background status\\n'), 20);`);
  assert.equal(status.url, "http://localhost:49882/ready");
  assert.equal(status.ambiguous, false);
  assert.equal(status.running, true);
  await s.stop();
  assert.equal(s.status().owned, false);
  assert.equal(running(status.pid), false);
});

test("a slow split must not guess a partial URL; stderr and IPv6 work", async (t) => {
  const s = server(t);
  const status = await start(s, `process.stderr.write('http://[::1]:49'); setTimeout(()=>process.stderr.write('874/route?x=1#ok\\n'),220); ${idle}`);
  assert.equal(status.url, "http://[::1]:49874/route?x=1#ok");
});

test("multiple URLs never select the first app; duplicate announcements are deduplicated", async (t) => {
  const s = server(t);
  const status = await start(s, `console.log('http://localhost:49875/a http://127.0.0.1:49876/b http://localhost:49875/a'); ${idle}`);
  assert.equal(status.ambiguous, true); assert.equal(status.url, undefined); assert.equal(status.urls.length, 2);
  assert.equal(status.running, true, "keep alive while human clarifies the actual URL");
});

test("bounded output and candidate count; raw logs/credentials and remote URLs are not returned", async (t) => {
  const s = server(t);
  const status = await start(s, `console.log('synthetic-secret '.repeat(10000)); console.log('http://localhost:secret@localhost:1234/ https://localhost:1234/ http://example.invalid/ http://0.0.0.0:1234/'); for (let n=0;n<40;n++) console.log('http://localhost:'+(49000+n)+'/'); ${idle}`);
  assert.equal(status.urls.length, 16); assert.equal(status.ambiguous, true); assert.equal(status.url, undefined);
  assert.doesNotMatch(JSON.stringify(status), /synthetic-secret|example.invalid|secret@|0\.0\.0\.0|https:/);
});

for (const [label, script, pattern] of [
  ["no URL", idle, /timed out/],
  ["unterminated URL", `process.stdout.write('http://localhost:49874/route'); ${idle}`, /timed out/],
  ["remote or HTTPS URL", `console.log('http://remote.invalid:1234/ https://localhost:1234/'); ${idle}`, /timed out/],
  ["early exit", "process.exit(4)", /exited/],
  ["URL followed by early exit", "console.log('http://localhost:49877/'); process.exit(0)", /exited/],
]) test(`${label} stops owned resources with accurate failure`, async (t) => {
  const s = server(t, 300);
  await assert.rejects(() => start(s, script), pattern);
  assert.equal(s.status().owned, false);
});

test("spawn failure and startup abort are cleaned up, with no phantom owned server", async (t) => {
  const s = server(t);
  await assert.rejects(() => s.start(join(tmpdir(), "nonexistent-workflow-executable"), [], cwd), /ENOENT/);
  assert.equal(s.status().owned, false);
  await assert.rejects(() => start(s, idle, AbortSignal.abort()), /abort/i);
  const controller = new AbortController();
  const pending = start(s, idle, controller.signal);
  setTimeout(() => controller.abort(), 50);
  await assert.rejects(() => pending, /abort/i);
  assert.equal(s.status().owned, false);
});

for (const boundary of [0, "SIGTERM", "SIGKILL"]) test(`Darwin transient EPERM at ${boundary} requires a confirmed retry`, { skip: process.platform !== "darwin" }, async (t) => {
  const s = server(t);
  const status = await start(s, `process.on('SIGTERM', () => {}); console.log('http://localhost:49883/'); ${idle}`);
  const kill = process.kill.bind(process);
  let denied = 0, confirmed = false;
  const mock = t.mock.method(process, "kill", (pid, signal) => {
    if (pid === -status.pid && signal === boundary) {
      if (denied++ < 2) throw Object.assign(new Error("synthetic zombie-only group"), { code: "EPERM" });
      try { const result = kill(pid, signal); confirmed = true; return result; }
      catch (error) { if (error.code === "ESRCH") confirmed = true; throw error; }
    }
    return kill(pid, signal);
  });
  try {
    await s.stop();
    assert.ok(denied >= 3);
    assert.equal(confirmed, true, "EPERM itself must never mean cleanup succeeded");
    assert.equal(s.status().owned, false);
    assert.equal(running(status.pid), false);
  } finally { mock.mock.restore(); await s.stop(); }
});

for (const code of ["EPERM", "EACCES"]) for (const boundary of [0, "SIGTERM"]) test(`persistent ${code} at ${boundary} preserves ownership and reports retained group`, async (t) => {
  const s = server(t);
  const status = await start(s, `process.on('SIGTERM', () => {}); console.log('http://localhost:49884/'); ${idle}`);
  const kill = process.kill.bind(process);
  let attempts = 0;
  const mock = t.mock.method(process, "kill", (pid, signal) => {
    if (pid === -status.pid && signal === boundary) {
      attempts++;
      throw Object.assign(new Error(`synthetic ${code}`), { code });
    }
    return kill(pid, signal);
  });
  try {
    await assert.rejects(() => s.stop(), new RegExp(`${code}.*retained process group ${status.pid}`));
    assert.equal(s.status().owned, true);
    assert.match(s.status().failure, /manual recovery/);
    assert.ok(running(status.pid));
    assert.equal(attempts > 1, process.platform === "darwin" && code === "EPERM");
  } finally { mock.mock.restore(); await s.stop(); }
  assert.equal(s.status().owned, false);
  assert.equal(running(status.pid), false);
});

async function eventually(check) {
  const until = Date.now() + 3000;
  while (!check()) { if (Date.now() > until) assert.fail("child cleanup did not complete"); await delay(30); }
}
function running(pid) {
  try { process.kill(pid, 0); }
  catch (error) { if (error.code === "ESRCH") return false; throw error; }
  // Linux can retain a killed orphan as a zombie until init reaps it.
  if (process.platform === "linux") { try { return !readFileSync(`/proc/${pid}/stat`, "utf8").match(/\) Z /); } catch { return false; } }
  return true;
}

test("stop kills stubborn owned descendants, not an unrelated user process", async (t) => {
  const s = server(t), temp = mkdtempSync(join(tmpdir(), "ui-tree-")), file = join(temp, "pid");
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const user = spawn(process.execPath, ["-e", idle], { stdio: "ignore" });
  t.after(() => user.kill());
  const descendant = `process.on('SIGTERM', () => {}); ${idle}`;
  await start(s, `const {spawn}=require('node:child_process'); const c=spawn(process.execPath,['-e',${JSON.stringify(descendant)}],{stdio:'ignore'}); require('node:fs').writeFileSync(${JSON.stringify(file)},String(c.pid)); console.log('http://localhost:49878/'); ${idle}`);
  const pid = Number(readFileSync(file, "utf8"));
  assert.ok(running(pid));
  await Promise.all([s.stop(), s.stop()]);
  await eventually(() => !running(pid));
  assert.ok(running(user.pid));
});

test("wrapper exit after startup also cleans descendants", async (t) => {
  const s = server(t), temp = mkdtempSync(join(tmpdir(), "ui-wrapper-")), file = join(temp, "pid");
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  await start(s, `const c=require('node:child_process').spawn(process.execPath,['-e',${JSON.stringify(idle)}],{stdio:'ignore'}); require('node:fs').writeFileSync(${JSON.stringify(file)},String(c.pid)); console.log('http://localhost:49879/'); setTimeout(()=>process.exit(0),400); ${idle}`);
  assert.ok(existsSync(file)); const pid = Number(readFileSync(file, "utf8"));
  await eventually(() => !running(pid));
  await eventually(() => !s.status().owned);
});

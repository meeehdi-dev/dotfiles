import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const install = join(homedir(), ".pi/agent/install");
const piRoot = process.env.PI_TEST_PACKAGE_ROOT ?? join(install, "releases", readFileSync(join(install, "current-version"), "utf8").trim(), "node_modules/@earendil-works/pi-coding-agent");
const { loadExtensions, createExtensionRuntime } = await import(pathToFileURL(join(piRoot, "dist/core/extensions/loader.js")));
const { createEventBus } = await import(pathToFileURL(join(piRoot, "dist/core/event-bus.js")));
const source = fileURLToPath(new URL("../../extensions/workflow-modes.ts", import.meta.url));

for (const kind of ["direct", "absolute symlink", "relative symlink"]) {
  test(`workflow extension loads through ${kind}`, async (t) => {
    const temp = realpathSync(mkdtempSync(join(tmpdir(), "pi-workflow-loader-")));
    t.after(() => rmSync(temp, { recursive: true, force: true }));
    const entry = kind === "direct" ? source : join(temp, "workflow-modes.ts");
    if (kind !== "direct") symlinkSync(kind === "relative symlink" ? relative(temp, source) : source, entry);
    const loaded = await loadExtensions([entry], temp, createEventBus(), createExtensionRuntime());
    assert.deepEqual(loaded.errors, []);
    assert.equal(loaded.extensions.length, 1);
    assert.deepEqual([...loaded.extensions[0].commands.keys()], ["work"]);
    assert.ok(loaded.extensions[0].tools.has("workflow_ui_server"));
  });
}

import { spawn, type ChildProcess } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { stripVTControlCharacters } from "node:util";

const LIMIT = 16384;
const URL_LIMIT = 16;

// Keep output in memory only for URL discovery; never return raw app logs (which may contain secrets).
export class UIServer {
  private owned?: { child: ChildProcess; pid?: number; ended: boolean; failure?: string };
  private stopping?: Promise<void>;
  private output = ["", ""];
  private urls = new Set<string>();
  private overflow = false;
  private changed = 0;

  constructor(private startupMs = 15000, private quietMs = 300, private graceMs = 750) {}

  status() {
    const urls = [...this.urls];
    return { owned: Boolean(this.owned), pid: this.owned?.pid, running: Boolean(this.owned && !this.owned.ended),
      urls, url: urls.length === 1 && !this.overflow ? urls[0] : undefined,
      ambiguous: urls.length > 1 || this.overflow, failure: this.owned?.failure };
  }

  private discover(chunk: string, stream: number) {
    this.output[stream] = (this.output[stream] + chunk).slice(-LIMIT);
    const text = stripVTControlCharacters(this.output[stream]);
    // shortcut: unterminated URLs need manual fallback; extend only for a concrete server without delimiters.
    for (const match of text.matchAll(/http:\/\/[^\s<>"'`]+(?=[\s<>"'`])/g)) {
      try {
        const raw = match[0];
        const url = new URL(raw);
        if (url.protocol !== "http:" || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || url.username || url.password) continue;
        if (!this.urls.has(raw) && !this.overflow) {
          if (this.urls.size < URL_LIMIT) this.urls.add(raw);
          else this.overflow = true;
          this.changed = Date.now();
        }
      } catch { /* Not a usable loopback URL. */ }
    }
  }

  async start(command: string, args: string[], cwd: string, signal?: AbortSignal) {
    signal?.throwIfAborted();
    if (process.platform === "win32") throw new Error("Owned process-group cleanup is unavailable; use manual startup/URL.");
    if (this.owned || this.stopping) throw new Error("A UI server is already owned; use status or stop before starting another.");
    if (!command || command.includes("\0") || args.some((arg) => arg.includes("\0"))) throw new Error("Invalid existing dev command.");
    this.output = ["", ""]; this.urls.clear(); this.overflow = false; this.changed = Date.now();
    const child = spawn(command, args, { cwd, detached: true, shell: false, stdio: ["ignore", "pipe", "pipe"] });
    const owned = this.owned = { child, pid: child.pid, ended: false, failure: undefined as string | undefined };
    child.stdout!.setEncoding("utf8").on("data", (chunk: string) => { this.discover(chunk, 0); });
    child.stderr!.setEncoding("utf8").on("data", (chunk: string) => { this.discover(chunk, 1); });
    child.on("error", (error) => { owned.failure = error.message; owned.ended = true; });
    child.on("exit", (code, signal) => {
      owned.ended = true;
      owned.failure = `Dev command exited (${code ?? signal}).`;
      // A wrapper can exit before its children; release its group, not just the wrapper.
      void this.stop().catch((error) => { owned.failure = String(error); });
    });
    const began = Date.now();
    try {
      while (true) {
        signal?.throwIfAborted();
        if (owned.ended || this.owned !== owned) throw new Error(owned.failure ?? "Dev command stopped during startup.");
        if (this.urls.size && Date.now() - this.changed >= this.quietMs) return this.status();
        if (Date.now() - began >= this.startupMs) throw new Error("Startup timed out without a usable loopback HTTP URL; use manual startup/URL.");
        await delay(25, undefined, { signal });
      }
    } catch (error) {
      await this.stop();
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (this.stopping) return this.stopping;
    const owned = this.owned;
    if (!owned) return;
    const send = async (signal: NodeJS.Signals | 0): Promise<boolean> => {
      if (!owned.pid) return false;
      const until = Date.now() + this.graceMs;
      while (true) {
        try { process.kill(-owned.pid, signal); return true; }
        catch (error) {
          const code = (error as NodeJS.ErrnoException).code;
          if (code === "ESRCH") return false;
          // Darwin returns EPERM for a zombie-only group until reaping; require a successful retry or ESRCH.
          if (process.platform !== "darwin" || code !== "EPERM" || Date.now() >= until) throw error;
          await delay(25);
        }
      }
    };
    this.stopping = (async () => {
      await send("SIGTERM");
      const until = Date.now() + this.graceMs;
      while (await send(0) && Date.now() < until) await delay(25);
      if (await send(0)) await send("SIGKILL");
      const killed = Date.now() + this.graceMs;
      while (!owned.ended && Date.now() < killed) await delay(25);
      if (!owned.ended) throw new Error(`Owned UI command did not exit; retained process group ${owned.pid}. Use manual recovery.`);
      // close also waits for inherited stdout/stderr, so don't wait on it for escaped descendants.
      owned.child.stdout?.destroy(); owned.child.stderr?.destroy();
      this.owned = undefined;
    })();
    try { await this.stopping; }
    catch (error) {
      owned.failure = `UI cleanup failed: ${String(error)}; retained process group ${owned.pid}. Use manual recovery.`;
      throw new Error(owned.failure, { cause: error });
    }
    finally { this.stopping = undefined; }
  }
}

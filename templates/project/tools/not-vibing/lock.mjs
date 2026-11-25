// One copy at a time for long-running scripts (batch jobs, queues, anything that spends quota).
// A stopped agent task can leave its script running; a restart would then start a second copy
// against the same key. This refuses to start while a live copy holds the lock.
//
// Usage: node tools/not-vibing/lock.mjs <name> -- "<command>"   (one quoted string, run by the shell)
//        node tools/not-vibing/lock.mjs --status <name>
// The lock lives in .git/not-vibing-locks/<name>.json (never committed). A lock whose process
// is gone is stale and taken over.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { git, root } from "./lib.mjs";

const dir = join(git(["rev-parse", "--absolute-git-dir"]) || join(root, ".git"), "not-vibing-locks");
const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === "EPERM";
  }
};
const held = (name) => {
  const f = join(dir, `${name}.json`);
  if (!existsSync(f)) return null;
  const lock = JSON.parse(readFileSync(f, "utf8"));
  return alive(lock.pid) ? lock : null;
};

const args = process.argv.slice(2);
if (args[0] === "--status") {
  const lock = held(args[1]);
  console.log(lock ? `held by pid ${lock.pid} since ${lock.started}: ${lock.command}` : "free");
  process.exit(0);
}
const sep = args.indexOf("--");
const name = args[0];
if (!name || sep !== 1 || args.length < 3) {
  console.error("usage: node tools/not-vibing/lock.mjs <name> -- \"<command>\"");
  process.exit(1);
}
const command = args.slice(2).join(" ");
const lock = held(name);
if (lock) {
  console.error(`lock "${name}" is held by pid ${lock.pid} (since ${lock.started}): ${lock.command}\nStop that process first; don't start a second copy.`);
  process.exit(1);
}
mkdirSync(dir, { recursive: true });
const file = join(dir, `${name}.json`);
const child = spawn(command, { cwd: root, shell: true, stdio: "inherit" });
// The lock names the child's pid: if this wrapper is killed but the job keeps running, the
// lock stays held, which is the case this guards against.
writeFileSync(file, JSON.stringify({ pid: child.pid, wrapper: process.pid, started: new Date().toISOString(), command }));
child.on("exit", (code) => {
  rmSync(file, { force: true });
  process.exit(code ?? 1);
});

// The full suite on this machine, recorded. Usage: node tools/not-vibing/full-check.mjs
// Runs config.json's commands.full (the same commands CI runs) and records the commit it ran on,
// whether it passed and how long it took, in .git/not-vibing-checks.json. Run it before a push
// when CI is rationed, slow or down: then "checked" stays a fact with a commit attached, and the
// audit can tell how far HEAD has moved since. Exit code 1 if any command fails.
import { git, loadConfig, recordCheck, run } from "./lib.mjs";

const config = loadConfig();
const commands = config.commands?.full || [];
if (!commands.length) {
  console.error('full-check: no commands.full in tools/not-vibing/config.json (put the commands CI runs there).');
  process.exit(1);
}
const dirty = (git(["status", "--porcelain", "--untracked-files=no"]) || "") !== "";
const commit = git(["rev-parse", "HEAD"]);
const started = Date.now();
const seconds = () => Math.round((Date.now() - started) / 1000);
for (const command of commands) {
  console.log(`full-check: ${command}`);
  const r = run(command, { timeoutSeconds: config.fullTimeoutSeconds || 1800 });
  if (!r.ok) {
    recordCheck("full", { commit, dirty, date: new Date().toISOString(), ok: false, seconds: seconds(), failed: command });
    console.error(r.output);
    console.error(`full-check: failed on "${command}".`);
    process.exit(1);
  }
}
recordCheck("full", { commit, dirty, date: new Date().toISOString(), ok: true, seconds: seconds() });
console.log(`full-check: passed on ${commit?.slice(0, 10)}${dirty ? " (with uncommitted changes: the record says so)" : ""} in ${seconds()} s`);

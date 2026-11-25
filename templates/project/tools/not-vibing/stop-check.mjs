// Stop hook: a fast typecheck when code was touched. Exit 2 keeps the agent working until it
// passes. Claude Code itself lets the turn end after 8 blocks in a row
// (CLAUDE_CODE_STOP_HOOK_BLOCK_CAP); the pre-commit hook still refuses the commit then.
import { git, isDocsOnly, loadConfig, run, tail } from "./lib.mjs";

const config = loadConfig();
const command = config.commands?.typecheck;
if (!command) process.exit(0);

const changed = (git(["status", "--porcelain"]) || "")
  .split("\n")
  .filter(Boolean)
  .map((l) => l.slice(3).replace(/^.* -> /, "").replaceAll('"', ""));
if (changed.length === 0 || isDocsOnly(changed, config)) process.exit(0);

const r = run(command, { timeoutSeconds: config.stopTimeoutSeconds || 30 });
if (r.ok) process.exit(0);
console.error(`Typecheck failed (${command}). Fix it before ending the turn:\n${tail(r.output, 40)}`);
process.exit(2);

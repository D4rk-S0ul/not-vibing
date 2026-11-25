// Git pre-commit check, called by .githooks/pre-commit. It catches commits made by any agent
// or by hand. Every commit: no CRLF, control byte or invisible character in a staged text
// file. Commits that touch code: the fast checks from config.json. CI runs the full suite.
import { execFileSync } from "node:child_process";
import { checkBoundaries, checkText, git, isDocsOnly, loadConfig, run } from "./lib.mjs";

const config = loadConfig();
const staged = (git(["diff", "--cached", "--name-only", "--diff-filter=ACMR"]) || "")
  .split("\n")
  .filter(Boolean);
if (staged.length === 0) process.exit(0);

const problems = [];
for (const path of staged) {
  const buf = execFileSync("git", ["show", `:${path}`], { maxBuffer: 64 * 1024 * 1024 });
  for (const p of [...checkText(buf, config, path), ...checkBoundaries(path, buf.toString("utf8"), config)]) {
    problems.push(`${path}: ${p}`);
  }
}
if (problems.length) {
  console.error(`pre-commit: refused.\n- ${problems.join("\n- ")}`);
  process.exit(1);
}

if (isDocsOnly(staged, config)) {
  console.log("pre-commit: docs only, text check passed (CI runs everything)");
  process.exit(0);
}

for (const command of config.commands?.precommit || []) {
  console.log(`pre-commit: ${command}`);
  const r = run(command, { timeoutSeconds: config.precommitTimeoutSeconds || 300 });
  if (!r.ok) {
    console.error(r.output);
    console.error(`pre-commit: refused, "${command}" failed. Fix it; never skip the hook.`);
    process.exit(1);
  }
}
console.log("pre-commit: passed");

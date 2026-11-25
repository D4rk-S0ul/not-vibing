// CI: the text check over every tracked file, for commits that reached the repo without the
// pre-commit hook (another machine, a web editor, a skipped hook).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { checkText, git, loadConfig, root } from "./lib.mjs";

const config = loadConfig();
const problems = [];
for (const path of (git(["ls-files"]) || "").split("\n").filter(Boolean)) {
  for (const p of checkText(readFileSync(join(root, path)), config, path)) problems.push(`${path}: ${p}`);
}
if (problems.length) {
  console.error(`text check failed:\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
console.log("text check passed");

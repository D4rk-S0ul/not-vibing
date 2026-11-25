// Pre-commit check for the kit's own repository (.githooks/pre-commit).
// 1. Personal data: every staged file is searched for the patterns in .personal-patterns, a
//    local, gitignored file (one case-insensitive regular expression per line, # comments).
//    The patterns name the maintainer, so they are never committed themselves.
// 2. Text: no CRLF, control byte or invisible character in a staged text file.
// 3. The kit's tests, unless only Markdown changed.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkText } from "../templates/project/tools/not-vibing/lib.mjs";

const root = join(fileURLToPath(import.meta.url), "..", "..");
const git = (...a) => execFileSync("git", a, { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const staged = git("diff", "--cached", "--name-only", "--diff-filter=ACMR").split("\n").filter(Boolean);
if (staged.length === 0) process.exit(0);

const patternsFile = join(root, ".personal-patterns");
const problems = [];
if (!existsSync(patternsFile)) {
  problems.push(".personal-patterns is missing: create it (gitignored) with one pattern per line for your name, user folder and email, so personal data can't be committed.");
}
const patterns = existsSync(patternsFile)
  ? readFileSync(patternsFile, "utf8").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#")).map((l) => new RegExp(l, "i"))
  : [];

// Commit metadata is published too: the author's name and email must not match either.
// Use GitHub's noreply address for this repository (git config user.email).
const ident = git("var", "GIT_AUTHOR_IDENT");
if (patterns.some((re) => re.test(ident))) {
  problems.push("The commit author (name or email) matches a personal-data pattern. Set this repository's identity to your public handle and GitHub's noreply address: git config user.name <handle>; git config user.email <id>+<handle>@users.noreply.github.com");
}

for (const path of staged) {
  const buf = execFileSync("git", ["show", `:${path}`], { cwd: root, maxBuffer: 64 * 1024 * 1024 });
  for (const p of checkText(buf, {}, path)) problems.push(`${path}: ${p}`);
  const lines = buf.toString("utf8").split("\n");
  for (const re of [...patterns]) {
    if (re.test(path)) problems.push(`${path}: the file name matches a personal-data pattern`);
    const n = lines.findIndex((l) => re.test(l));
    if (n >= 0) problems.push(`${path}:${n + 1}: matches a personal-data pattern. Replace it with something generic (a role, a placeholder, a relative path).`);
  }
}
if (problems.length) {
  console.error(`kit pre-commit: refused.\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
if (staged.every((p) => p.endsWith(".md"))) {
  console.log("kit pre-commit: Markdown only; personal-data and text checks passed");
  process.exit(0);
}
const r = spawnSync(process.execPath, ["--test", "tests/kit.test.mjs"], { cwd: root, encoding: "utf8" });
if (r.status !== 0) {
  console.error(`${r.stdout}${r.stderr}\nkit pre-commit: refused, the tests failed.`);
  process.exit(1);
}
console.log("kit pre-commit: personal-data check, text check and tests passed");

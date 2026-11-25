// PreToolUse hook for Bash and PowerShell: the git rules that have no exceptions, read
// from the whole command.
// Permission rules can't do this reliably: `git -C . commit --no-verify`, `git commit -anm`
// and a bare `git push` (which names no branch) all slip past argument patterns.
// - Skipping the pre-commit hook is refused (--no-verify, -n, or pointing core.hooksPath away).
// - A force push is refused.
// - A push that reaches a protected branch (main) or tags asks the user; work branches push
//   freely.
// - A command that would ask must be that git step alone (nothing chained, piped or redirected,
//   under 200 characters), else it is refused with how to run it: the user's prompt shows the
//   whole command, so it then reads as one short question.
import { readFileSync } from "node:fs";
import { git, loadConfig } from "./lib.mjs";

const input = JSON.parse(readFileSync(0, "utf8") || "{}");
const raw = String(input.tool_input?.command || "");
// Quoted strings (commit messages) can't contain flags; blank them before looking.
const command = (input.tool_input?.command || "").replace(/"(?:\\.|[^"\\])*"|'[^']*'/g, '""');
const segments = command
  .split(/&&|\|\||[;|&\n]/)
  .map((s) => s.trim())
  .filter((s) => /(^|\s)git(\s|$)/.test(s));
if (segments.length === 0) process.exit(0);

const config = loadConfig();
const protectedBranches = config.protectedBranches || ["main", "master"];
const decide = (permissionDecision, permissionDecisionReason) => {
  console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision, permissionDecisionReason } }));
  process.exit(0);
};
const NO_HOOK =
  "Skipping the pre-commit hook is refused: it is the check that holds for every agent. Fix what it reports and commit again.";

const reasons = [];
for (const seg of segments) {
  const words = seg.split(/\s+/);
  const g = words.indexOf("git");
  // Global options before the subcommand: -C <dir>, -c <key=value>, --git-dir=..., etc.
  let i = g + 1;
  const globals = [];
  while (i < words.length && words[i].startsWith("-")) {
    globals.push(words[i]);
    if (["-C", "-c"].includes(words[i])) globals.push(words[++i] || "");
    i++;
  }
  const sub = words[i];
  const args = words.slice(i + 1);

  if (globals.some((w) => /^core\.hookspath=/i.test(w))) decide("deny", NO_HOOK);
  if (sub === "config" && args.some((a) => /^core\.hookspath$/i.test(a))) {
    const value = args[args.findIndex((a) => /^core\.hookspath$/i.test(a)) + 1];
    if (value !== undefined && value !== ".githooks") decide("deny", NO_HOOK);
  }
  if (sub === "commit") {
    if (args.some((a) => a === "--no-verify" || /^-[a-zA-Z]*n[a-zA-Z]*$/.test(a))) decide("deny", NO_HOOK);
  }
  if (sub !== "push") continue;

  if (args.some((a) => /^--force(-with-lease|-if-includes)?(=|$)/.test(a) || /^-[a-zA-Z]*f[a-zA-Z]*$/.test(a) || a.startsWith("+"))) {
    decide("deny", "Force pushes are refused: they rewrite history others (and CI) have seen. Push a new commit instead; if history really must change, the user does it by hand.");
  }
  if (args.some((a) => ["--all", "--mirror", "--tags", "--follow-tags", "--delete", "-d"].includes(a) || a.startsWith("refs/tags/"))) {
    reasons.push("Allow a push of tags, every branch, or a deleted ref?");
    continue;
  }
  const refspecs = args.filter((a) => !a.startsWith("-")).slice(1);
  let targets;
  if (refspecs.length) {
    targets = refspecs.map((r) => (r.includes(":") ? r.split(":")[1] : r)).map((r) => r.replace(/^refs\/heads\//, ""));
    if (targets.includes("HEAD")) targets.push(git(["rev-parse", "--abbrev-ref", "HEAD"]) || "HEAD");
  } else {
    // Bare push: the current branch goes to its upstream (or to the same name).
    const upstream = git(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]);
    targets = [upstream ? upstream.replace(/^[^/]+\//, "") : git(["rev-parse", "--abbrev-ref", "HEAD"]) || "?"];
  }
  const hit = targets.filter((t) => protectedBranches.includes(t) || /^v\d/.test(t));
  if (hit.length) reasons.push(`Allow push to ${hit.join(", ")}?`);
}
if (reasons.length) {
  if (/&&|\|\||[;|&<>\n]/.test(command) || raw.length > 200) {
    decide(
      "deny",
      "Run only `git push <remote> <branch>`, nothing chained or redirected and under 200 characters, so the user's prompt shows just this push. Do the rest in separate calls.",
    );
  }
  decide("ask", `${reasons.join(" ")} It makes the work official (CI, deploys, releases).`);
}
process.exit(0);

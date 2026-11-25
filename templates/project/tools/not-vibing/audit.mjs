// The script part of the Not Vibing audit. Read-only: it changes nothing.
// Usage: node audit.mjs [--root <repo>] [--commits 50]
// Prints a Markdown report: measured facts, then findings ranked by impact. The judgment part
// (which numbers drove decisions, what is written twice, prose rules vs hooks) is the agent's.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { ciState, gitState, reviewState } from "./state.mjs";

const arg = (name, dflt) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : dflt;
};
const root = arg("--root", process.cwd());
const nCommits = Number(arg("--commits", 50));
const git = (args) => {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
};
const read = (p) => (existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : null);
const lineCount = (t) => t.replace(/\n$/, "").split("\n").length;

const facts = [];
const findings = []; // { impact: 3 high | 2 medium | 1 low, text }
const find = (impact, text) => findings.push({ impact, text });

// 1. Instruction files, with their @imports (one level).
facts.push("## Instruction files", "");
let instr = 0;
for (const f of ["CLAUDE.md", ".claude/CLAUDE.md", "AGENTS.md", "CLAUDE.local.md"]) {
  const t = read(f);
  if (t === null) continue;
  instr++;
  const n = lineCount(t);
  const imports = [...t.matchAll(/^@(\S+)/gm)].map((m) => m[1]);
  let total = n;
  for (const imp of imports) {
    const it = read(join(dirname(f), imp));
    if (it !== null) total += lineCount(it);
  }
  facts.push(`- \`${f}\`: ${n} lines${imports.length ? `, with imports ${total} (${imports.join(", ")})` : ""}`);
  if (f === "AGENTS.md" && n > 80) find(1, `\`AGENTS.md\` has ${n} lines; the kit's budget is about 80.`);
  if (total > 200) find(2, `\`${f}\` loads ${total} lines; Anthropic's guidance is under 200: past that, lines get missed.`);
}
if (!instr) find(3, "No instruction file (CLAUDE.md or AGENTS.md).");
const shouting = (read("CLAUDE.md") || "") + (read("AGENTS.md") || "");
const caps = (shouting.match(/\b(IMPORTANT|MUST|NEVER|ALWAYS|CRITICAL)\b/g) || []).length;
if (caps) facts.push(`- Shouted words (IMPORTANT, MUST, NEVER, ...): ${caps}. Shouting doesn't help: a line that keeps being missed belongs in a hook.`);

// 2. Hooks and permission rules.
facts.push("", "## Enforcement", "");
let hookCount = 0;
let gitGuard = false;
let noVerifyRule = false;
const userSettings = join(homedir(), ".claude", "settings.json");
for (const f of [".claude/settings.json", ".claude/settings.local.json", "~/.claude/settings.json"]) {
  const t = f.startsWith("~") ? (existsSync(userSettings) ? readFileSync(userSettings, "utf8") : null) : read(f);
  if (t === null) continue;
  let s;
  try {
    s = JSON.parse(t);
  } catch {
    find(3, `\`${f}\` is not valid JSON: none of its rules apply.`);
    continue;
  }
  for (const [event, groups] of Object.entries(s.hooks || {})) {
    for (const g of groups) {
      for (const h of g.hooks || []) {
        if (!f.startsWith("~")) hookCount++;
        const cmd = [h.command, ...(h.args || [])].filter(Boolean).join(" ") || h.type;
        if (f === ".claude/settings.json" && event === "PreToolUse" && /git-guard/.test(cmd)) gitGuard = true;
        facts.push(`- ${f}: hook ${event}${g.matcher ? ` [${g.matcher}]` : ""}: \`${cmd.slice(0, 100)}\``);
      }
    }
  }
  for (const kind of ["deny", "ask", "allow"]) {
    const rules = s.permissions?.[kind] || [];
    if (rules.length) facts.push(`- ${f}: ${kind} (${rules.length}): ${rules.slice(0, 12).map((r) => `\`${r}\``).join(", ")}${rules.length > 12 ? ", ..." : ""}`);
  }
  if (f === ".claude/settings.json" && (s.permissions?.deny || []).some((r) => r.includes("no-verify"))) noVerifyRule = true;
}
if (!gitGuard) {
  find(2, `Nothing reads the whole git command before it runs${noVerifyRule ? " (a deny rule for `--no-verify` exists, but argument patterns miss `git -C . commit --no-verify` or `-nm`)" : ""}: the agent can skip the pre-commit hook or force-push. The kit's git-guard hook covers both.`);
}
if (!hookCount) find(2, "No Claude Code hooks in the project: its rules are prose (user-level hooks, if any, are listed below but travel with the machine, not the repo).");
if (hookCount > 15) find(2, `${hookCount} Claude Code hooks: about forty means most are preferences. Check which ones guard a never-rule.`);
const hooksPath = git(["config", "core.hooksPath"]);
const hookDir = hooksPath || ".git/hooks";
const gitHooks = existsSync(join(root, hookDir))
  ? readdirSync(join(root, hookDir)).filter((h) => !h.endsWith(".sample"))
  : [];
facts.push(`- git hooks (${hooksPath ? `core.hooksPath=${hooksPath}` : ".git/hooks"}): ${gitHooks.join(", ") || "none"}`);
if (!gitHooks.includes("pre-commit")) find(3, "No active git pre-commit hook: commits made outside the agent are unchecked.");
const workflows = existsSync(join(root, ".github/workflows")) ? readdirSync(join(root, ".github/workflows")) : [];
facts.push(`- CI workflows: ${workflows.join(", ") || "none"}`);
if (!workflows.length) find(3, "No CI workflow: there is no second instance.");

// 3. CI and git state.
const g = gitState(root);
const ci = ciState(root, g.main);
facts.push("", "## CI and git", "");
if (!ci.available) {
  facts.push("- CI: not readable (no GitHub remote, gh missing, or not signed in).");
  find(2, "CI state could not be read: the audit can't tell whether `main` is tested.");
} else if (!ci.latest) {
  facts.push(`- CI: no runs on ${g.main}.`);
  if (workflows.length) find(3, `No CI run on ${g.main} at all.`);
} else {
  const days = (d) => Math.floor((Date.now() - new Date(d)) / 86400000);
  const l = ci.latest;
  facts.push(`- Latest run on ${g.main}: ${l.conclusion || l.status}, ${l.createdAt.slice(0, 10)} (${days(l.createdAt)} days ago), id ${l.databaseId}`);
  facts.push(`- Last green run: ${ci.lastGreen ? `${ci.lastGreen.createdAt.slice(0, 10)} (${days(ci.lastGreen.createdAt)} days ago)` : "none in the last 30"}`);
  facts.push(`- Newest green run on a commit local ${g.main} contains: ${ci.lastGreenInMain ? `${ci.lastGreenInMain.createdAt.slice(0, 10)}; local ${g.main} is ${ci.aheadOfLastGreenInMain} commit(s) ahead of it` : "none"}`);
  if (ci.aheadOfLatestRun === null) facts.push(`- The latest run's commit is not in local ${g.main} (not fetched, or the branches diverged).`);
  const untested = ci.aheadOfLastGreenInMain;
  if (untested === null) find(3, `No green CI run on any commit local ${g.main} contains.`);
  else if (untested > 0) find(3, `Local ${g.main} is ${untested} commit(s) ahead of its last green CI run: those commits are tested only on the laptop.`);
  if (l.conclusion && l.conclusion !== "success") find(3, `The latest CI run on ${g.main} ended \`${l.conclusion}\`.`);
}
facts.push(`- ${g.main} vs origin: ${g.aheadOfOrigin === null ? "no origin" : `${g.aheadOfOrigin} commit(s) ahead`}${g.lastRelease ? `; ${g.aheadOfRelease} ahead of release ${g.lastRelease}` : ""}`);
if (g.aheadOfOrigin > 0) find(2, `${g.main} has ${g.aheadOfOrigin} unpushed commit(s): CI hasn't seen them.`);

// 4. Share of recent commits that only touch docs.
const log = git(["log", g.main, `-${nCommits}`, "--name-only", "--format=@@%H"]) || "";
const commits = log.split("@@").filter(Boolean).map((c) => c.trim().split("\n").slice(1).filter(Boolean));
const docsOnly = commits.filter((files) => files.length && files.every((f) => f.endsWith(".md") || f.startsWith("docs/") || f.startsWith(".claude/")));
const share = commits.length ? Math.round((100 * docsOnly.length) / commits.length) : 0;
facts.push(`- Docs-only commits: ${docsOnly.length} of the last ${commits.length} (${share} %)`);
if (share >= 40) find(2, `${share} % of the last ${commits.length} commits only touch docs: process may be crowding out product work.`);

// 5. More than one home for where we stand and what is next.
const homes = [];
const walk = (dir, depth) => {
  if (depth > 3 || !existsSync(join(root, dir))) return;
  for (const e of readdirSync(join(root, dir))) {
    if ([".git", "node_modules", "dist", "build", ".claude"].includes(e)) continue;
    const p = dir ? `${dir}/${e}` : e;
    let st;
    try {
      st = statSync(join(root, p));
    } catch {
      continue;
    }
    if (/^(STATUS|PLAN|PARKED|TODO|ROADMAP|BACKLOG|NEXT[-_ ]?STEPS?)\.md$/i.test(e) || /next-steps/i.test(e)) homes.push(p);
    else if (st.isDirectory() && /^(weeknotes|weekly|notes|journal)$/i.test(e)) homes.push(`${p}/ (${readdirSync(join(root, p)).length} files)`);
    if (st.isDirectory()) walk(p, depth + 1);
  }
};
walk("", 0);
facts.push(`- Files for where we stand and what is next: ${homes.join(", ") || "none"}`);
if (homes.length > 1) find(2, `${homes.length} places hold status, plans or next steps (${homes.join(", ")}): one step can be written down several times. The kit keeps STATUS.md and steps.json only.`);

// 6. Observed components: a tier-1 or tier-2 number, and when it was last measured.
facts.push("", "## Components and evidence", "");
const stepsText = read("steps.json");
if (stepsText === null) {
  facts.push("- No `steps.json`: components, their kind of truth and their evidence tiers are not recorded in a form a script can read.");
  find(2, "No `steps.json`: the audit can't check whether each observed component has a tier-1 or tier-2 number. The agent must find the numbers behind past decisions by reading.");
} else {
  let steps;
  try {
    steps = JSON.parse(stepsText);
  } catch {
    steps = null;
    find(3, "`steps.json` is not valid JSON.");
  }
  for (const c of steps?.components || []) {
    const good = (c.measurements || []).filter((m) => m.tier === 1 || m.tier === 2).sort((a, b) => (a.date < b.date ? 1 : -1));
    facts.push(`- ${c.id} (${c.kind}): reference "${c.reference || "none"}"; last tier-1/2 measurement ${good[0] ? `${good[0].date} (${good[0].what}, tier ${good[0].tier})` : "none"}`);
    if (!good.length && c.kind === "observed") find(3, `Observed component \`${c.id}\` has no tier-1 or tier-2 measurement: every number about it is a proxy nobody checked.`);
    else if (!good.length) find(2, `Component \`${c.id}\` (${c.kind}) has no tier-1 or tier-2 measurement yet.`);
  }
  for (const s of steps?.steps || []) {
    if (s.pass && s.evidence && s.evidence.tier > 2) find(3, `Step \`${s.id}\` is marked passed on tier-${s.evidence.tier} evidence: a tier-3 number may describe, never decide.`);
  }
  const weakened = (steps?.steps || []).filter((s) => (s.weakened || []).length);
  if (weakened.length) facts.push(`- Steps with a weakened criterion: ${weakened.map((s) => s.id).join(", ")}`);
}

// 7. Stale STATUS.
const statusPath = ["STATUS.md", "docs/STATUS.md"].find((p) => read(p) !== null);
facts.push("", "## STATUS and reviews", "");
if (!statusPath) find(2, "No STATUS.md: a new session has nowhere to start from.");
else {
  const last = git(["log", "-1", "--format=%H %cI", g.main, "--", statusPath]);
  const since = last ? Number(git(["rev-list", "--count", `${last.split(" ")[0]}..${g.main}`])) : null;
  const n = lineCount(read(statusPath));
  facts.push(`- \`${statusPath}\`: ${n} lines, last changed ${last ? last.split(" ")[1].slice(0, 10) : "never committed"}; commits since: ${since ?? "?"}`);
  if (since > 0) find(1, `\`${statusPath}\` is older than the last ${since} commit(s): the next session may start from a stale picture.`);
  if (n > 60) find(1, `\`${statusPath}\` has ${n} lines; the kit's limit is 60.`);
}

// 8. Outside review.
const rv = reviewState(root, "docs/reviews", g.main);
facts.push(`- Last outside review (newest commit in docs/reviews/): ${rv.lastReview ?? "never"}; commits since: ${rv.commitsSince}; active weeks without one: ${rv.activeWeeksSince}`);
if (rv.due) find(3, `Outside review overdue: ${rv.activeWeeksSince} active week(s) and ${rv.commitsSince} commits since the last one (${rv.lastReview ?? "never"}).`);

// 9. Mistakes recorded as notes (principle 9: a repeated mistake becomes a mechanism).
// Lists the agent's memory notes for this project and the instruction lines that describe a
// pitfall. Whether each happened more than once and has a mechanism is the agent's judgment.
facts.push("", "## Mistakes recorded as notes", "");
const slug = resolve(root).replace(/[^A-Za-z0-9]/g, "-");
const projects = join(homedir(), ".claude", "projects");
const memDir = existsSync(projects)
  ? readdirSync(projects).filter((d) => d.toLowerCase() === slug.toLowerCase()).map((d) => join(projects, d, "memory")).find(existsSync)
  : null;
const datePattern = /20\d\d-\d\d-\d\d/g;
if (!memDir) facts.push("- No Claude Code memory folder for this project.");
else {
  const notes = readdirSync(memDir).filter((f) => f.endsWith(".md") && f !== "MEMORY.md");
  const feedback = [];
  for (const f of notes) {
    const t = readFileSync(join(memDir, f), "utf8");
    const type = (t.match(/^\s*type:\s*(\S+)/m) || [])[1] || "?";
    const desc = ((t.match(/^description:\s*(.*)$/m) || [])[1] || "").replace(/^"|"$/g, "").replaceAll('\\"', '"');
    const dates = new Set(t.match(datePattern) || []);
    if (type === "feedback") feedback.push(`- \`${f}\` (${dates.size} date(s) in the note${dates.size > 1 ? ": may have happened more than once" : ""}): ${desc.slice(0, 140)}`);
  }
  facts.push(`- Memory folder: ${notes.length} notes, ${feedback.length} of type feedback (mistakes and corrections):`);
  facts.push(...feedback.map((l) => `  ${l}`));
  if (feedback.length) find(2, `${feedback.length} feedback notes in the agent's memory. For each: has it happened more than once, and is there a hook, script or test for it? A repeated mistake without a mechanism is a finding (agent's judgment).`);
}
const pitfalls = [];
const userClaude = join(homedir(), ".claude", "CLAUDE.md");
const sources = [
  ["CLAUDE.md", read("CLAUDE.md")],
  ["AGENTS.md", read("AGENTS.md")],
  ["~/.claude/CLAUDE.md", existsSync(userClaude) ? readFileSync(userClaude, "utf8") : null],
];
for (const [f, t] of sources) {
  (t || "").split("\n").forEach((l, i) => {
    if (/pitfall|went wrong|get(s)? lost|broke|break|mangle|instead of|never through|arrives as|exits 0/i.test(l)) pitfalls.push(`${f}:${i + 1}`);
  });
}
facts.push(`- Instruction lines that describe a mistake or pitfall: ${pitfalls.length ? pitfalls.join(", ") : "none found"}`);

findings.sort((a, b) => b.impact - a.impact);
const label = { 3: "high", 2: "medium", 1: "low" };
console.log(`# Not Vibing audit: ${relative(dirname(root), root) || root}`);
console.log(`\nMeasured ${new Date().toISOString().slice(0, 10)} by tools/not-vibing/audit.mjs (read-only).\n`);
console.log("## Findings from the script, by impact\n");
console.log(findings.length ? findings.map((f, i) => `${i + 1}. **${label[f.impact]}**: ${f.text}`).join("\n") : "None.");
console.log(`\n${facts.join("\n")}`);

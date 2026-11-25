// The script part of the Not Vibing audit. Read-only: it changes nothing.
// Usage: node audit.mjs [--root <repo>] [--commits 50]
// Prints a Markdown report: measured facts, then findings ranked by impact. The judgment part
// (which numbers drove decisions, what is written twice, prose rules vs hooks) is the agent's.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { readChecks } from "./lib.mjs";
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
// Content that current guidance says to leave out: the agent can read the repo itself.
const overview = [];
for (const f of ["CLAUDE.md", ".claude/CLAUDE.md", "AGENTS.md"]) {
  (read(f) || "").split("\n").forEach((l, i) => {
    if (/^#+\s.*\b(architecture|directory|directories|folder|folders|map|structure|layout|overview)\b/i.test(l) || /[├└]──/.test(l)) overview.push(`${f}:${i + 1}`);
  });
}
if (overview.length) find(1, `Architecture, folder or tree content in the instruction file (${overview.slice(0, 6).join(", ")}${overview.length > 6 ? ", ..." : ""}): the agent can read the repo; this costs context in every session and goes stale.`);
const gates = [];
for (const f of ["CLAUDE.md", ".claude/CLAUDE.md", "AGENTS.md"]) {
  (read(f) || "").split("\n").forEach((l, i) => {
    if (/\b(okay|ok|approv\w*|confirm\w*|consent)\b.*\bbefore (any|every|each|writing|starting|building)\b/i.test(l)) gates.push(`${f}:${i + 1}`);
  });
}
if (gates.length) facts.push(`- Lines that may gate every step (an approval before any code or change): ${gates.join(", ")}. Judgment item 8 decides whether each gates an outcome or every step.`);
if (caps) facts.push(`- Shouted words (IMPORTANT, MUST, NEVER, ...): ${caps}. Shouting doesn't help: a line that keeps being missed belongs in a hook.`);

// 2. Hooks and permission rules.
facts.push("", "## Enforcement", "");
let hookCount = 0;
let gitGuard = false;
let noVerifyRule = false;
const enforcers = []; // every permission rule and hook command, to match never-lines against
const events = { project: new Set(), user: new Set() };
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
        enforcers.push(`${f} ${event} hook ${cmd}`);
        events[f.startsWith("~") ? "user" : "project"].add(event);
        if (f === ".claude/settings.json" && event === "PreToolUse" && /git-guard/.test(cmd)) gitGuard = true;
        facts.push(`- ${f}: hook ${event}${g.matcher ? ` [${g.matcher}]` : ""}: \`${cmd.slice(0, 100)}\``);
      }
    }
  }
  for (const kind of ["deny", "ask", "allow"]) {
    const rules = s.permissions?.[kind] || [];
    for (const r of rules) enforcers.push(`${f} ${kind} ${r}`);
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

// Hook events in use. Each of the four gives something the others don't.
const eventUse = {
  PreToolUse: "reads a command before it runs (skipped hooks, force pushes, quota)",
  PostToolUse: "checks each edit as it lands (line endings, invisible characters)",
  Stop: "fast feedback before a turn ends (typecheck)",
  SessionStart: "puts where we stand into a new session",
};
facts.push(`- Hook events in the project: ${[...events.project].join(", ") || "none"}; user-level: ${[...events.user].join(", ") || "none"}`);
const missingEvents = Object.keys(eventUse).filter((e) => !events.project.has(e));
if (missingEvents.length && hookCount) {
  find(1, `No project hook for ${missingEvents.join(", ")}: ${missingEvents.map((e) => `${e} ${eventUse[e]}`).join("; ")}.${missingEvents.some((e) => events.user.has(e)) ? " Some are covered at user level, which holds on this machine only." : ""}`);
}

// Never-, only- and opt-in lines in the instruction files, against the rules and hooks.
// A token of the line (a backticked word, a path, a --flag) found in a rule or hook command
// counts as a match. No match doesn't prove the line is unguarded: a hook may cover it without
// naming it. The agent settles that by reading (judgment item 3).
const instrText = [];
for (const f of ["CLAUDE.md", ".claude/CLAUDE.md", "AGENTS.md"]) {
  const t = read(f);
  if (t !== null) instrText.push([f, t]);
}
const ruleLines = [];
for (const [f, t] of instrText) {
  let inComment = false;
  t.split("\n").forEach((l, i) => {
    if (l.includes("<!--")) inComment = true;
    const skip = inComment || /^\s*#/.test(l);
    if (l.includes("-->")) inComment = false;
    if (skip || !/\b(never|only|opt-in|must not|do not|don't)\b/i.test(l)) return;
    const tokens = [
      ...[...l.matchAll(/`([^`]+)`/g)].map((m) => m[1]),
      ...(l.match(/(?:^|\s)((?:--?[a-z][\w-]*)|(?:[\w.-]+\/[\w./*-]*))/gi) || []).map((s) => s.trim()),
    ]
      .map((s) => s.replace(/[*()]+$/g, "").replace(/\/+$/, "").toLowerCase())
      .filter((s) => s.length > 2);
    const hit = enforcers.find((e) => tokens.some((tk) => e.toLowerCase().includes(tk)));
    ruleLines.push({ at: `${f}:${i + 1}`, text: l.trim().replace(/^[-*]\s*/, "").slice(0, 90), hit });
  });
}
if (ruleLines.length) {
  facts.push(`- Never/only/opt-in lines in the instruction files (${ruleLines.length}), against the rules and hooks:`);
  for (const r of ruleLines.slice(0, 30)) facts.push(`  - ${r.at}: "${r.text}": ${r.hit ? `matches \`${r.hit.slice(0, 80)}\`` : "no rule or hook names it"}`);
  if (ruleLines.length > 30) facts.push(`  - ... and ${ruleLines.length - 30} more`);
  const open = ruleLines.filter((r) => !r.hit);
  if (open.length) find(2, `${open.length} of ${ruleLines.length} never/only/opt-in lines have no rule or hook that names them (${open.slice(0, 5).map((r) => r.at).join(", ")}${open.length > 5 ? ", ..." : ""}). Check each: commands that spend quota want an ask rule or hook, paths that must never change a deny rule, the rest a test.`);
}

// What a code commit costs. A hook that takes minutes invites skipping it.
const checks = readChecks(root);
const warnSeconds = (() => {
  try {
    return JSON.parse(read("tools/not-vibing/config.json") || "{}").precommitWarnSeconds || 120;
  } catch {
    return 120;
  }
})();
if (checks.precommit) {
  const p = checks.precommit;
  facts.push(`- Last code-commit pre-commit run: ${p.seconds} s, ${p.ok ? "passed" : `failed on \`${p.failed}\``}, ${p.date.slice(0, 10)}`);
  if (p.seconds > warnSeconds) find(2, `The pre-commit checks for a code commit took ${p.seconds} s (over ${warnSeconds} s): slow enough to tempt skipping. Keep the fast checks in the hook and move the rest to \`full-check.mjs\` before a push, and to CI.`);
} else if (gitHooks.includes("pre-commit")) {
  facts.push("- Pre-commit runtime for a code commit: no record. The agent times it or asks (judgment item 4); docs-only commits being cheap says nothing about code commits.");
}

// Commands and skills. Custom commands are skills now; a skill with side effects should not be
// one the model can start on its own.
const listDir = (p) => (existsSync(join(root, p)) ? readdirSync(join(root, p)) : []);
const commandFiles = listDir(".claude/commands").filter((f) => f.endsWith(".md"));
const skillFiles = listDir(".claude/skills")
  .map((d) => `.claude/skills/${d}/SKILL.md`)
  .filter((p) => existsSync(join(root, p)));
facts.push(`- Skills: ${skillFiles.length}; old-style commands in \`.claude/commands/\`: ${commandFiles.length}`);
if (commandFiles.length) find(1, `${commandFiles.length} file(s) in \`.claude/commands/\` (${commandFiles.slice(0, 5).join(", ")}): commands are skills now. Move each to \`.claude/skills/<name>/SKILL.md\`, which adds frontmatter such as \`disable-model-invocation\`.`);
const sideEffects = /\b(git push|npm publish|gh release create|git tag \S+|deploy(s|ing)?|publish(es|ing)?|upload(s|ing)?)\b/i;
const unguarded = [...commandFiles.map((f) => `.claude/commands/${f}`), ...skillFiles].filter((p) => {
  const t = read(p) || "";
  return sideEffects.test(t) && !/^disable-model-invocation:\s*true/m.test(t);
});
if (unguarded.length) find(2, `Skills or commands with side effects (deploy, release, push, publish) that the model may start on its own: ${unguarded.join(", ")}. Add \`disable-model-invocation: true\` to their frontmatter.`);

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

// What keeps "checked" a fact if CI were unavailable for a week: a local full-check record.
if (checks.full) {
  const f = checks.full;
  const behind = f.commit && git(["merge-base", "--is-ancestor", f.commit, "HEAD"]) !== null ? git(["rev-list", "--count", `${f.commit}..HEAD`]) : null;
  facts.push(`- Last local full check (full-check.mjs): ${f.ok ? "passed" : `failed on \`${f.failed}\``} on ${f.commit?.slice(0, 10)}${f.dirty ? " with uncommitted changes" : ""}, ${f.date.slice(0, 10)}, ${f.seconds} s; HEAD is ${behind ?? "?"} commit(s) past it`);
} else {
  facts.push("- Last local full check: no record (`tools/not-vibing/full-check.mjs` writes one). Without CI, nothing says which commit was last fully checked.");
  if (!ci.available || !ci.lastGreenInMain || ci.aheadOfLastGreenInMain > 0 || (workflows.length && !/^\s*(push|pull_request)\s*:|\[\s*(push|pull_request)/m.test(workflows.map((w) => read(`.github/workflows/${w}`) || "").join("\n")))) {
    find(2, "No record of a local full check, and CI is unreadable, behind, or rationed: if CI were unavailable for a week, nothing would say which commit last passed the full suite. Run `full-check.mjs` before pushes; it records the commit.");
  }
}

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
// Leftovers: extra worktrees, branches already merged, branches nobody touched in a month.
const worktrees = (git(["worktree", "list", "--porcelain"]) || "").split("\n").filter((l) => l.startsWith("worktree ")).length;
const merged = (git(["branch", "--merged", g.main, "--format=%(refname:short)"]) || "").split("\n").filter((b) => b && b !== g.main);
const monthAgo = Date.now() / 1000 - 30 * 86400;
const old = (git(["for-each-ref", "refs/heads", "--format=%(refname:short) %(committerdate:unix)"]) || "")
  .split("\n")
  .map((l) => l.split(" "))
  .filter(([b, d]) => b && b !== g.main && !merged.includes(b) && Number(d) < monthAgo)
  .map(([b]) => b);
facts.push(`- Worktrees: ${worktrees}; branches merged into ${g.main}: ${merged.length}; unmerged branches untouched for 30 days: ${old.length}`);
if (worktrees > 1 || merged.length || old.length) {
  find(1, `Leftovers: ${[worktrees > 1 ? `${worktrees - 1} extra worktree(s)` : "", merged.length ? `merged branches ${merged.slice(0, 5).join(", ")}${merged.length > 5 ? ", ..." : ""}` : "", old.length ? `branches untouched for 30 days ${old.slice(0, 5).join(", ")}${old.length > 5 ? ", ..." : ""}` : ""].filter(Boolean).join("; ")}. Remove or tag them, after the user's okay.`);
}

// Closed measurements: frozen sets, archives, replay and golden tests. Each keeps costing
// test time and attention after its decision is made.
const closed = [];
const walkClosed = (dir, depth) => {
  if (depth > 4 || !existsSync(join(root, dir || "."))) return;
  for (const e of readdirSync(join(root, dir || "."))) {
    if ([".git", "node_modules", "dist", "build", ".venv", "venv"].includes(e)) continue;
    const p = dir ? `${dir}/${e}` : e;
    let st;
    try {
      st = statSync(join(root, p));
    } catch {
      continue;
    }
    if (/^(frozen|archive[sd]?|replays?|golden|snapshots?|__snapshots__)$/i.test(e) || (!st.isDirectory() && /(replay|archive|frozen|golden)[\w.-]*\.(test|spec)\.|test[_-](replay|archive|frozen|golden)/i.test(e))) {
      closed.push(st.isDirectory() ? `${p}/ (${readdirSync(join(root, p)).length} entries)` : p);
      if (st.isDirectory()) continue;
    }
    if (st.isDirectory()) walkClosed(p, depth + 1);
  }
};
walkClosed("", 0);
facts.push(`- Frozen sets, archives, replay or golden tests: ${closed.length ? closed.slice(0, 12).join(", ") + (closed.length > 12 ? ", ..." : "") : "none found"}`);
if (closed.length) find(1, `${closed.length} frozen set(s), archive(s) or replay test(s): which still guard a live decision, and which serve a measurement that is closed and could be retired under a tag (judgment item 9)?`);

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

// Decisions that record a caveat about their own evidence (a bias, a self-graded number).
const adrDir = ["docs/adr", "docs/decisions", "adr"].find((d) => existsSync(join(root, d)));
const caveats = [];
let adrsInForce = 0;
if (adrDir) {
  for (const f of readdirSync(join(root, adrDir)).filter((n) => n.endsWith(".md") && !/^0000/.test(n))) {
    const t = read(`${adrDir}/${f}`) || "";
    if (/^\W*status\W*:?\W*(superseded|deprecated|rejected)/im.test(t)) continue;
    adrsInForce++;
    t.split("\n").forEach((l, i) => {
      if (/may favou?r|drafted by|self-graded|graded by the same|same (session|model)|\bbias(ed)?\b|not (yet )?(calibrated|checked|validated)|never (calibrated|checked|validated)/i.test(l)) caveats.push(`${adrDir}/${f}:${i + 1}`);
    });
  }
  facts.push(`- ADRs in force: ${adrsInForce}; lines where one records a caveat about its own evidence: ${caveats.join(", ") || "none"}`);
  if (caveats.length) find(2, `${caveats.length} line(s) where an ADR in force records a caveat about its own evidence (${caveats.slice(0, 5).join(", ")}${caveats.length > 5 ? ", ..." : ""}): what tier is the number it rests on, and was the caveat ever settled?`);
  if (stepsText === null && adrsInForce) find(1, `${adrsInForce} ADR(s) in force and no \`steps.json\`: propose an evidence tier on each step and on each ADR still in force, so a script can find decisions resting on tier 3.`);
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

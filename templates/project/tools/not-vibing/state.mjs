// Where the project stands, from git and CI. Self-contained (no project imports) so the audit
// can run it against any repository: node state.mjs --root <path>.
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

function sh(cmd, args, cwd, timeout = 15000) {
  try {
    return execFileSync(cmd, args, { cwd, encoding: "utf8", timeout, stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

export function mainBranch(root) {
  const head = sh("git", ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"], root);
  if (head) return head.replace(/^origin\//, "");
  for (const b of ["main", "master"]) if (sh("git", ["rev-parse", "--verify", "--quiet", b], root)) return b;
  return sh("git", ["symbolic-ref", "--short", "HEAD"], root) || "main";
}

const count = (root, range) => {
  const n = sh("git", ["rev-list", "--count", range], root);
  return n === null ? null : Number(n);
};

export function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return `${d.getUTCFullYear()}-W${String(Math.ceil(((d - start) / 86400000 + 1) / 7)).padStart(2, "0")}`;
}

export function gitState(root) {
  const main = mainBranch(root);
  const hasOrigin = sh("git", ["rev-parse", "--verify", "--quiet", `origin/${main}`], root) !== null;
  const tag = sh("git", ["describe", "--tags", "--abbrev=0", main], root);
  return {
    main,
    aheadOfOrigin: hasOrigin ? count(root, `origin/${main}..${main}`) : null,
    lastRelease: tag,
    aheadOfRelease: tag ? count(root, `${tag}..${main}`) : null,
    lastCommitDate: sh("git", ["log", "-1", "--format=%cI", main], root),
  };
}

// CI runs on main, newest first. null when gh is missing or not signed in.
export function ciState(root, main = mainBranch(root)) {
  const raw = sh(
    "gh",
    ["run", "list", "--branch", main, "--limit", "30", "--json", "databaseId,headSha,conclusion,status,createdAt,workflowName,event"],
    root,
    20000,
  );
  if (raw === null) return { available: false };
  const runs = JSON.parse(raw);
  const latest = runs[0] || null;
  const green = runs.find((r) => r.conclusion === "success") || null;
  const inMain = (sha) => sh("git", ["merge-base", "--is-ancestor", sha, main], root) !== null;
  const since = (sha) => (sha && inMain(sha) ? count(root, `${sha}..${main}`) : null);
  // The newest run whose commit local main contains: what local main has really been tested on.
  const tested = runs.find((r) => r.conclusion === "success" && inMain(r.headSha)) || null;
  return {
    available: true,
    latest,
    lastGreen: green,
    aheadOfLatestRun: latest ? since(latest.headSha) : null,
    aheadOfLastGreen: green ? since(green.headSha) : null,
    lastGreenInMain: tested,
    aheadOfLastGreenInMain: tested ? since(tested.headSha) : null,
  };
}

// The last outside review: the newest commit touching the reviews folder.
export function reviewState(root, dir = "docs/reviews", main = mainBranch(root)) {
  const last = sh("git", ["log", "-1", "--format=%H %cI", main, "--", dir], root);
  const range = last ? `${last.split(" ")[0]}..${main}` : main;
  const dates = (sh("git", ["log", "--format=%cI", range], root) || "").split("\n").filter(Boolean);
  const weeks = new Set(dates.map((d) => isoWeek(new Date(d))));
  // The review's own week is covered by it.
  if (last) weeks.delete(isoWeek(new Date(last.split(" ")[1])));
  return {
    lastReview: last ? last.split(" ")[1].slice(0, 10) : null,
    commitsSince: dates.length,
    activeWeeksSince: weeks.size,
    due: weeks.size > 0,
  };
}

export function summaryLines(root) {
  const g = gitState(root);
  const ci = ciState(root, g.main);
  const rv = reviewState(root, undefined, g.main);
  const lines = [];
  if (!ci.available) lines.push("CI: unknown (no GitHub remote, gh missing, or not signed in)");
  else if (!ci.latest) lines.push(`CI: no runs on ${g.main}`);
  else {
    const l = ci.latest;
    lines.push(`CI: latest run on ${g.main} ${l.status === "completed" ? l.conclusion : l.status} (${l.createdAt.slice(0, 10)}, id ${l.databaseId}); ${ci.aheadOfLatestRun === null ? "its commit is not in local " + g.main + " (fetch, or the branches diverged)" : `local ${g.main} is ${ci.aheadOfLatestRun} commit(s) ahead of it`}`);
    if (ci.aheadOfLatestRun === null || ci.aheadOfLatestRun > 0) lines.push(`CI: newest green run on a commit local ${g.main} contains: ${ci.lastGreenInMain ? `${ci.lastGreenInMain.createdAt.slice(0, 10)}, ${ci.aheadOfLastGreenInMain} commit(s) untested since` : "none in the last 30"}`);
    if (l.conclusion !== "success") lines.push(`CI: last green run ${ci.lastGreen ? `${ci.lastGreen.createdAt.slice(0, 10)}, ${ci.aheadOfLastGreen ?? "?"} commit(s) behind ${g.main}` : "none in the last 30"}`);
  }
  lines.push(`git: ${g.aheadOfOrigin === null ? `no origin/${g.main}` : `${g.main} is ${g.aheadOfOrigin} commit(s) ahead of origin`}${g.lastRelease ? `, ${g.aheadOfRelease} ahead of release ${g.lastRelease}` : ""}`);
  lines.push(`Outside review: last ${rv.lastReview ?? "never"}; commits since: ${rv.commitsSince}, active weeks without one: ${rv.activeWeeksSince}${rv.due ? " -> a review is due (/not-vibing:review)" : ""}`);
  return lines;
}

if (import.meta.url === `file:///${process.argv[1].replaceAll("\\", "/").replace(/^\//, "")}`) {
  const i = process.argv.indexOf("--root");
  console.log(summaryLines(i > 0 ? process.argv[i + 1] : process.cwd()).join("\n"));
}

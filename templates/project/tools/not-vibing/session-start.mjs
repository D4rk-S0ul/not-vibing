// SessionStart hook: puts STATUS.md and the CI and git state into the agent's context, so a
// session starts from where the last one stopped and never from a stale belief about CI.
// Also runnable by hand or by any agent: node tools/not-vibing/session-start.mjs
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { root } from "./lib.mjs";
import { summaryLines } from "./state.mjs";

const out = [];
const status = join(root, "STATUS.md");
out.push(existsSync(status) ? readFileSync(status, "utf8").trim() : "STATUS.md is missing.");
out.push("", "## State at session start (measured by tools/not-vibing/session-start.mjs)", "");
for (const l of summaryLines(root)) out.push(`- ${l}`);
console.log(out.join("\n"));

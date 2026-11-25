// Is the kit's knowledge of the agent older than 30 days?
// Usage: node scripts/freshness.mjs [--today YYYY-MM-DD]
// EVAL_NOT_VIBING_TODAY sets the same date for the eval suite (evals/freshness-stale).
// Prints "fresh" or "stale" with the age, and exits 0 either way.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const file = join(dirname(fileURLToPath(import.meta.url)), "..", "assumptions.md");
const text = readFileSync(file, "utf8");
const m = text.match(/^last-checked:\s*(\d{4}-\d{2}-\d{2})/m);
if (!m) {
  console.log(`stale: no last-checked date in ${file}`);
  process.exit(0);
}
const i = process.argv.indexOf("--today");
const fixed = i > 0 ? process.argv[i + 1] : process.env.EVAL_NOT_VIBING_TODAY;
const today = fixed ? new Date(fixed) : new Date();
const days = Math.floor((today - new Date(m[1])) / 86400000);
console.log(days > 30 ? `stale: last checked ${m[1]}, ${days} days ago` : `fresh: last checked ${m[1]}, ${days} days ago`);
console.log(`assumptions: ${file}`);

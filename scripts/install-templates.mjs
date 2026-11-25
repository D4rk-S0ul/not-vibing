// Copies the project templates into a repository. Never overwrites: existing files are listed
// and skipped, so the agent can merge them by hand.
// Usage: node scripts/install-templates.mjs <target-dir> [--dry-run]
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const src = join(dirname(fileURLToPath(import.meta.url)), "..", "templates", "project");
const target = process.argv[2];
const dry = process.argv.includes("--dry-run");
if (!target) {
  console.error("usage: node install-templates.mjs <target-dir> [--dry-run]");
  process.exit(1);
}

const copied = [];
const skipped = [];
const walk = (dir) => {
  for (const e of readdirSync(dir)) {
    const from = join(dir, e);
    if (statSync(from).isDirectory()) walk(from);
    else {
      const rel = relative(src, from).replaceAll("\\", "/");
      const to = join(target, rel);
      if (existsSync(to)) skipped.push(rel);
      else {
        if (!dry) {
          mkdirSync(dirname(to), { recursive: true });
          copyFileSync(from, to);
        }
        copied.push(rel);
      }
    }
  }
};
walk(src);
console.log(`${dry ? "would copy" : "copied"} (${copied.length}):\n  ${copied.join("\n  ")}`);
if (skipped.length) console.log(`skipped, already present (${skipped.length}):\n  ${skipped.join("\n  ")}`);

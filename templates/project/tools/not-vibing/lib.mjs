// Shared helpers for the Not Vibing checks. Plain Node, no dependencies.
// Character codes are written as numbers on purpose: escape sequences get mangled when
// agents edit files through shell or Python strings.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();

export function loadConfig() {
  const p = join(root, "tools", "not-vibing", "config.json");
  if (!existsSync(p)) return {};
  return JSON.parse(readFileSync(p, "utf8"));
}

// Format characters that render as nothing: soft hyphen, zero-width and direction marks,
// line/paragraph separators, bidirectional embeddings and overrides (which can make code read
// differently from how it runs), word joiners and invisible operators, a BOM.
const INVISIBLE = new Set([
  0x00ad, 0x200b, 0x200c, 0x200d, 0x200e, 0x200f, 0x2028, 0x2029, 0x202a, 0x202b, 0x202c,
  0x202d, 0x202e, 0x2060, 0x2061, 0x2062, 0x2063, 0x2064, 0xfeff,
]);
// No-break spaces look like spaces. In prose they can be meant (typography), in code they
// are a bug, so they count only in files with a code extension.
const NO_BREAK = new Set([0x00a0, 0x202f]);
const CODE = /\.(ts|tsx|js|jsx|mjs|cjs|py|sh|ps1|json|ya?ml|css|html|toml|rs|go|java|kt|swift|c|h|cpp|cs|rb|php|sql)$/i;

export function isBinary(buf) {
  const n = Math.min(buf.length, 8000);
  for (let i = 0; i < n; i++) if (buf[i] === 0) return true;
  return false;
}

// Returns a list of problems in one text file: carriage returns, control bytes, invisible
// characters. Each problem names the first line where it occurs and how often. `path` decides
// whether no-break spaces count (code files only).
export function checkText(buf, config = {}, path = "") {
  if (isBinary(buf)) return [];
  const allowed = new Set(config.allowInvisible || []);
  const isCode = CODE.test(path);
  const text = buf.toString("utf8");
  const found = new Map();
  let line = 1;
  for (const ch of text) {
    const c = ch.codePointAt(0);
    let kind = null;
    if (c === 13) kind = "carriage return (CRLF line ending)";
    else if (c < 32 && c !== 9 && c !== 10) kind = `control byte ${c}`;
    else if (c === 127) kind = "control byte 127";
    else if ((INVISIBLE.has(c) || (isCode && NO_BREAK.has(c))) && !allowed.has(c)) {
      kind = `invisible character U+${c.toString(16).toUpperCase().padStart(4, "0")}`;
    }
    if (kind) {
      const f = found.get(kind) || { line, count: 0 };
      f.count++;
      found.set(kind, f);
    }
    if (c === 10) line++;
  }
  return [...found].map(([kind, f]) => `${kind}: ${f.count}x, first on line ${f.line}. ${remedy(kind)}`);
}

// What to do instead: the hook's message carries the fix, so the instruction file needn't.
function remedy(kind) {
  if (kind.startsWith("carriage")) {
    return "Rewrite the file with LF endings through the file-edit tool; scripts must write with newline \"\\n\" (Python: open(..., newline=\"\\n\")).";
  }
  if (kind.startsWith("control")) {
    return "Usually a lost backslash (\\b became a backspace byte): rewrite that line through the file-edit tool, never through a shell or Python string.";
  }
  return "Usually a \\u escape that arrived as the literal character: write the escape again, or code that needs none (for example a numeric char code); if the character is meant, add its code to allowInvisible in tools/not-vibing/config.json.";
}

// Boundary rules from config.json: files under `path` must not contain any `forbid` string.
export function checkBoundaries(relPath, text, config = {}) {
  const out = [];
  const p = relPath.replaceAll("\\", "/");
  for (const b of config.boundaries || []) {
    if (!p.startsWith(b.path)) continue;
    for (const s of b.forbid) {
      if (text.includes(s)) out.push(`boundary: "${s}" in ${b.path} (${b.reason})`);
    }
  }
  return out;
}

// Runs a configured command through the shell. Returns { ok, output }.
export function run(command, { timeoutSeconds = 120 } = {}) {
  const r = spawnSync(command, {
    cwd: root,
    shell: true,
    encoding: "utf8",
    timeout: timeoutSeconds * 1000,
  });
  const output = `${r.stdout || ""}${r.stderr || ""}`;
  if (r.error && r.error.code === "ETIMEDOUT") {
    return { ok: false, output: `${output}\n(timed out after ${timeoutSeconds}s)` };
  }
  return { ok: r.status === 0, output };
}

export function git(args) {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

export function tail(text, lines = 40) {
  return text.trimEnd().split("\n").slice(-lines).join("\n");
}

// Files that cannot break code: docs, Markdown, agent configuration.
export function isDocsOnly(paths, config = {}) {
  const prefixes = config.docsPaths || ["docs/", ".claude/"];
  return (
    paths.length > 0 &&
    paths.every((p) => p.endsWith(".md") || prefixes.some((d) => p.startsWith(d)))
  );
}

// Local record of the last checks that ran on this clone, in .git/not-vibing-checks.json
// (never committed). Keys: "precommit" (the last code commit's checks) and "full" (the last
// full-check.mjs run). The audit reads it: what keeps "checked" a fact when CI is rationed.
export function checksPath(dir = root) {
  let gitDir = null;
  try {
    gitDir = execFileSync("git", ["rev-parse", "--absolute-git-dir"], { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {}
  return join(gitDir || join(dir, ".git"), "not-vibing-checks.json");
}

export function readChecks(dir = root) {
  try {
    return JSON.parse(readFileSync(checksPath(dir), "utf8"));
  } catch {
    return {};
  }
}

export function recordCheck(key, value) {
  try {
    writeFileSync(checksPath(), JSON.stringify({ ...readChecks(), [key]: value }, null, 2) + "\n");
  } catch {}
}

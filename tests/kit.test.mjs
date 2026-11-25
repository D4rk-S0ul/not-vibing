// The kit's own checks: free, deterministic, and runnable anywhere with `node --test tests/`.
// The eval suite in evals/ covers the skills; this covers the scripts they rely on.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const kit = join(fileURLToPath(import.meta.url), "..", "..");
const tools = join(kit, "templates", "project", "tools", "not-vibing");
const tempRepo = () => {
  const dir = mkdtempSync(join(tmpdir(), "nv-test-"));
  const g = (...a) => execFileSync("git", a, { cwd: dir, stdio: "ignore" });
  g("init", "-q", "-b", "main");
  g("-c", "user.email=t@example.invalid", "-c", "user.name=t", "commit", "-q", "--allow-empty", "-m", "init");
  return { dir, g };
};
const node = (script, input, cwd, env = {}) =>
  spawnSync(process.execPath, [script], { input, cwd, encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: cwd, ...env } });

test("git guard: refuses skipping the hook and force pushes, asks for main and tags", () => {
  const { dir, g } = tempRepo();
  const decide = (command) => {
    const r = node(join(tools, "git-guard.mjs"), JSON.stringify({ tool_input: { command } }), dir);
    return r.stdout ? JSON.parse(r.stdout).hookSpecificOutput.permissionDecision : "allow";
  };
  const onMain = {
    'git commit -m "fix -n handling"': "allow",
    "git commit --no-verify -m x": "deny",
    "git commit -nm x": "deny",
    "git -C . commit -an -m x": "deny",
    "git commit -am wip": "allow",
    "git -c core.hooksPath=/dev/null commit -m x": "deny",
    "git config core.hooksPath .githooks": "allow",
    "git config core.hooksPath /tmp/none": "deny",
    "git push": "ask",
    "git push origin feature/x": "allow",
    "git push -f origin feature/x": "deny",
    "git push --force-with-lease": "deny",
    "git push origin +feature/x": "deny",
    "git push --tags": "ask",
    "git push origin v1.2.0": "ask",
    "git -C . push origin main": "ask",
    "git push origin HEAD:main": "ask",
    "npm test && git push": "ask",
    "git status && git log -1": "allow",
    "ls": "allow",
  };
  for (const [command, expected] of Object.entries(onMain)) assert.equal(decide(command), expected, command);
  g("checkout", "-q", "-b", "feature/y");
  assert.equal(decide("git push"), "allow", "bare push on a work branch");
  assert.equal(decide("git push -u origin HEAD"), "allow", "HEAD on a work branch");
});

test("edit check: refuses CRLF, control bytes and invisible characters, with what to do", () => {
  const { dir } = tempRepo();
  const check = (content) => {
    const file = join(dir, "f.txt");
    writeFileSync(file, content);
    return node(join(tools, "check-edit.mjs"), JSON.stringify({ tool_input: { file_path: file } }), dir);
  };
  assert.equal(check("clean\n").status, 0);
  const crlf = check("a\r\nb\n");
  assert.equal(crlf.status, 2);
  assert.match(crlf.stderr, /carriage return.*LF endings/);
  assert.equal(check(`a${String.fromCharCode(8)}b\n`).status, 2);
  assert.equal(check(`a${String.fromCharCode(0xad)}b\n`).status, 2);
  assert.equal(check(`a${String.fromCharCode(0x202e)}b\n`).status, 2, "bidi override");
  const nbsp = (name) => {
    const file = join(dir, name);
    writeFileSync(file, `z.${String.fromCharCode(0xa0)}B.\n`);
    return node(join(tools, "check-edit.mjs"), JSON.stringify({ tool_input: { file_path: file } }), dir).status;
  };
  assert.equal(nbsp("prose.md"), 0, "no-break space in prose is allowed");
  assert.equal(nbsp("code.js"), 2, "no-break space in code is refused");
});

test("git guard also reads PowerShell commands", () => {
  const { dir } = tempRepo();
  const input = JSON.stringify({ tool_name: "PowerShell", tool_input: { command: "git add -A; git commit --no-verify -m x" } });
  const r = node(join(tools, "git-guard.mjs"), input, dir);
  assert.equal(JSON.parse(r.stdout).hookSpecificOutput.permissionDecision, "deny");
  const settings = JSON.parse(readFileSync(join(kit, "templates", "project", ".claude", "settings.json"), "utf8"));
  assert.equal(settings.hooks.PreToolUse[0].matcher, "Bash|PowerShell");
});

test("lock: a second copy refuses to start while the first runs", async () => {
  const { dir } = tempRepo();
  const lock = join(tools, "lock.mjs");
  const { spawn } = await import("node:child_process");
  const first = spawn(process.execPath, [lock, "job", "--", `node -e "setTimeout(()=>{},3000)"`], { cwd: dir, env: { ...process.env, CLAUDE_PROJECT_DIR: dir } });
  await new Promise((r) => setTimeout(r, 1000));
  const second = spawnSync(process.execPath, [lock, "job", "--", "node -e 0"], { cwd: dir, encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: dir } });
  assert.equal(second.status, 1);
  assert.match(second.stderr, /is held by pid/);
  await new Promise((r) => first.on("exit", r));
  const third = spawnSync(process.execPath, [lock, "job", "--", "node -e 0"], { cwd: dir, encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: dir } });
  assert.equal(third.status, 0);
});

test("freshness: stale after 30 days, fresh before", () => {
  const date = readFileSync(join(kit, "assumptions.md"), "utf8").match(/^last-checked:\s*(\S+)/m)[1];
  const day = (n) => new Date(new Date(date).getTime() + n * 86400000).toISOString().slice(0, 10);
  const run = (today) => execFileSync(process.execPath, [join(kit, "scripts", "freshness.mjs"), "--today", today], { encoding: "utf8" });
  assert.match(run(day(30)), /^fresh/);
  assert.match(run(day(31)), /^stale/);
  const rel = execFileSync(process.execPath, [join(kit, "scripts", "freshness.mjs")], { encoding: "utf8", env: { ...process.env, EVAL_NOT_VIBING_TODAY: "+32" } });
  assert.match(rel, /^stale: .* 32 days ago/);
});

test("audit: runs read-only on a bare repo and reports the missing pieces", () => {
  const { dir } = tempRepo();
  const before = execFileSync("git", ["status", "--porcelain"], { cwd: dir, encoding: "utf8" });
  const out = execFileSync(process.execPath, [join(tools, "audit.mjs"), "--root", dir], { encoding: "utf8" });
  assert.match(out, /# Not Vibing audit/);
  assert.match(out, /No instruction file/);
  assert.match(out, /No active git pre-commit hook/);
  assert.equal(execFileSync("git", ["status", "--porcelain"], { cwd: dir, encoding: "utf8" }), before);
});

test("templates: valid JSON, no leftover pieces of the old design", () => {
  for (const f of ["steps.json", ".claude/settings.json", "tools/not-vibing/config.json"]) {
    JSON.parse(readFileSync(join(kit, "templates", "project", f), "utf8"));
  }
  const settings = readFileSync(join(kit, "templates", "project", ".claude", "settings.json"), "utf8");
  assert.doesNotMatch(settings, /push-guard|PROTECTED_PATH|FROZEN_PATH|QUOTA_COMMAND/);
});

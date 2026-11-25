// PostToolUse hook for Edit/Write: checks the edited file at once.
// Line endings, control bytes and invisible characters; boundary rules; lint on that file.
// Exit 2 sends the problems back to the agent, which then fixes them.
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, relative } from "node:path";
import { checkBoundaries, checkText, loadConfig, root, run, tail } from "./lib.mjs";

const input = JSON.parse(readFileSync(0, "utf8") || "{}");
const file = input.tool_input?.file_path;
if (!file) process.exit(0);
const abs = isAbsolute(file) ? file : join(root, file);
if (!existsSync(abs)) process.exit(0);
const rel = relative(root, abs).replaceAll("\\", "/");
if (rel.startsWith("..")) process.exit(0); // outside the project

const config = loadConfig();
const buf = readFileSync(abs);
const problems = [...checkText(buf, config, rel), ...checkBoundaries(rel, buf.toString("utf8"), config)];

const lint = config.commands?.lintFile;
const exts = config.lintExtensions || [];
if (problems.length === 0 && lint && exts.some((e) => rel.endsWith(e))) {
  const r = run(lint.replaceAll("{file}", JSON.stringify(rel)), { timeoutSeconds: 20 });
  if (!r.ok) problems.push(`lint failed:\n${tail(r.output, 30)}`);
}

if (problems.length) {
  console.error(`${rel}:\n- ${problems.join("\n- ")}`);
  process.exit(2);
}

---
name: audit
description: Audit a running project's harness - instruction length, hooks and permissions, CI staleness, docs-only commits, evidence tiers, stale STATUS - then judge which numbers drove decisions and what is written twice. Read-only; proposes changes.
disable-model-invocation: true
allowed-tools:
  - Read(${CLAUDE_PLUGIN_ROOT}/**)
  - Bash(node "${CLAUDE_PLUGIN_ROOT}/scripts/*)
  - Bash(node "${CLAUDE_PLUGIN_ROOT}/templates/project/tools/not-vibing/*)
argument-hint: "[path to the repository, default: here]"
---

Audit the project at: $ARGUMENTS (empty: the current directory). Read-only: change nothing
in it, not even a report file, unless the user says so after seeing the report.

## 0. Freshness

Follow `${CLAUDE_PLUGIN_ROOT}/scripts/freshness.md`.

## 1. Script part

Run `node "${CLAUDE_PLUGIN_ROOT}/templates/project/tools/not-vibing/audit.mjs" --root <path>`
(or the project's own copy in `tools/not-vibing/`). It reads git, `gh` and the files and
prints measured facts and findings. Keep its output; don't re-derive its numbers.

## 2. Judgment part

Read what the script can't judge. Start from the instruction file, the status file and the
most recent decisions (ADRs, the step or plan files, the last 30 commit messages); open more
only to settle a finding. For each item give the evidence (file and line, or a command and
its output).

1. **Numbers behind decisions.** Take the last five or so decisions: a default chosen, an
   approach killed, a stage or step called done. For each, the number it rested on and its
   tier: 1 = the truth source itself, 2 = a proxy shown to agree with it, 3 = a proxy never
   checked against it. A decision on a tier-3 number is a high finding. Look in particular
   for a metric that counts partial results as full ones, and for criteria changed after the
   result was seen.
2. **Written twice.** Facts or steps held in more than one place (status, plan, parked,
   next-steps, weekly notes, stage files, the instruction file). Name each pair and which
   home should stay.
3. **Prose that should be a hook, and prose a hook made redundant.** Never-rules in the
   instruction file that no hook, deny rule or CI step enforces. And the reverse: lines that
   restate what a mechanism already enforces for every agent in use (project or user-level
   hooks in `~/.claude/settings.json` count): they should go, if the mechanism's message says
   what to do instead; if it doesn't, the fix is a better message, not the line.
4. **Hooks that are preferences.** Hooks or checks that guard taste rather than a never-rule,
   and checks that cost more than they catch (a pre-commit hook that runs minutes for a
   docs-only commit).
5. **The second instance.** Whether CI still runs on what is committed, and whether anyone
   reads it.
6. **Loops.** Any autonomous loop (`/goal`, `/loop`, Stop hooks, `claude -p`) pointed at a
   tier-3 number.
7. **Repeated mistakes.** For each memory note and instruction line the script lists as
   describing a mistake: has it happened more than once (dates in the note, "again", the
   same fix in several commits)? Is there a hook, script or test that catches it? A mistake
   that happened more than once without a mechanism is a finding; propose the mechanism, and
   that the note then only points to it.

## 3. Report

A short report in chat:
- findings ranked by impact (script and judgment together, highest first), each in one or two
  lines with its evidence;
- what is good and should stay, in a few lines;
- a proposal: the few changes worth making, in order, each with how its effect would be
  checked.
Then ask which changes to make. Nothing is changed without the user's okay. If the user wants
the report kept, write it to `docs/reviews/<date>-audit.md` only then.

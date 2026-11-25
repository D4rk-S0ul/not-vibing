---
name: audit
description: Audit a running project's harness - instruction length and content, hooks and the rules they cover, CI and local checks, pre-commit cost, skills, leftovers, evidence tiers, stale STATUS - then judge which numbers drove decisions and what is written twice. Read-only; proposes changes.
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
   result was seen. Read each ADR still in force that the script lists with a caveat about
   its own evidence ("may favor", "drafted by", "not calibrated"): was the caveat settled,
   and what tier is the number now? Without `steps.json`, propose that every step and every
   ADR in force name its evidence tier.
2. **Written twice.** Facts or steps held in more than one place (status, plan, parked,
   next-steps, weekly notes, stage files, the instruction file). Name each pair and which
   home should stay.
3. **Prose that should be a hook, and prose a hook made redundant.** Go through the script's
   list of never/only/opt-in lines. For each line it says nothing names, settle whether a
   mechanism covers it anyway. Look beyond the never-rules written in prose: commands that
   spend quota (live runs, probes, batch jobs) want an ask rule or a hook, paths that must
   never change a deny rule, and the fast feedback hooks (Stop typecheck, SessionStart
   summary) are missing if the script lists those events as unused. And the reverse: lines that
   restate what a mechanism already enforces for every agent in use (project or user-level
   hooks in `~/.claude/settings.json` count): they should go, if the mechanism's message says
   what to do instead; if it doesn't, the fix is a better message, not the line.
4. **Hooks that are preferences, and what checks cost.** Hooks or checks that guard taste
   rather than a never-rule, and checks that cost more than they catch. Look at the cost of a
   code commit, not only a docs-only one: if the script has no runtime record, read the
   hook's tiers and say what a typical code commit runs and roughly how long (ask the user
   before timing it). Over about 2 minutes is a finding; the usual remedy is fast checks in
   the hook and the full suite in `full-check.mjs` before a push and in CI.
5. **The second instance, as a risk, not a state.** Whether CI still runs on what is
   committed and whether anyone reads it. A green CI today is not the answer: ask what would
   keep "checked" a fact if CI were unavailable for a week (rationed minutes, an outage).
   Without a local full-check record that names its commit, the answer is "nothing".
6. **Loops.** Any autonomous loop (`/goal`, `/loop`, Stop hooks, `claude -p`) pointed at a
   tier-3 number.
7. **Repeated mistakes.** For each memory note and instruction line the script lists as
   describing a mistake: has it happened more than once (dates in the note, "again", the
   same fix in several commits)? Is there a hook, script or test that catches it? A mistake
   that happened more than once without a mechanism is a finding; propose the mechanism, and
   that the note then only points to it.
8. **Instruction-file content and gates.** Content the agent's own current guidance says to
   leave out (architecture overviews, folder descriptions, anything the agent can read from
   the repo), and rules that gate every step rather than an outcome (an approval before any
   code is written). The script lists candidate lines; judge each.
9. **Closed measurements.** For each frozen set, archive and replay test the script lists:
   does it still guard a live decision, or does it serve a measurement that is closed? What
   does it cost (test runtime, attention)? Propose retiring closed ones under a git tag, so
   they can be brought back.

## 3. Report

A short report in chat:
- findings ranked by impact (script and judgment together, highest first), each in one or two
  lines with its evidence;
- what is good and should stay, in a few lines;
- a proposal: the few changes worth making, in order, each with how its effect would be
  checked.
Then ask which changes to make. Nothing is changed without the user's okay. If the user wants
the report kept, write it to `docs/reviews/<date>-audit.md` only then.

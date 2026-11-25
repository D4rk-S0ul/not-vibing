---
name: session-start
description: Start a work session - where we stand, the CI state, and one proposed goal with its criterion. Use at the beginning of a session.
disable-model-invocation: true
argument-hint: "[goal]"
---

Start of a session. Goal named by the user, if any: $ARGUMENTS

`AGENTS.md` (through `CLAUDE.md`) and `STATUS.md` (through the SessionStart hook) are already
in context in Claude Code; another agent reads `STATUS.md` first. Nothing else yet: open
`steps.json`, an ADR or code only for what this session's goal needs.

1. Where we stand and what is open, in at most five lines, from `STATUS.md`.
2. The measured state, from the SessionStart hook's output (another agent runs
   `node tools/not-vibing/session-start.mjs`). Report:
   - CI: every run on the main branch back to and including the newest green one, so a
     failure from an earlier session is never skipped. A finished failure comes first:
     propose fixing it as this session's goal. A run still in progress: watch it in the
     background and report its conclusion (read the conclusion; a watcher can exit 0 on a
     cancelled run).
   - How far the main branch is ahead of CI, of origin and of the last release.
   - The outside review line. If one is due, or this session will decide on a number
     (choose a default, kill an approach, call a stage done), say so and suggest
     `/not-vibing:review` first.
3. Propose one goal with a measurable acceptance criterion, written before any result is
   seen. Unless the user named one, take the next step from `STATUS.md`. Say:
   - which component it serves, that component's kind of truth, and the tier of the evidence
     the criterion will use;
   - whether it is a normal step or a spike (then the kill line, fixed now);
   - if the step needs something from the user first (a verdict, a look at a preview), what,
     and propose the next step that doesn't.

Change no files. Wait for the user's okay.

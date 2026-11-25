# {{PROJECT_NAME}}

<!-- Not Vibing template. Budget about 80 lines (Anthropic's limit is 200): only what an agent can't learn from the repo.
     No architecture overview, no directory listing. A line that keeps being missed belongs in
     a hook, not in capitals. Delete this comment when filled. -->

Read `STATUS.md` first (where we stand, the next step). Steps and their evidence: `steps.json`.

## Mission

{{MISSION: two to four lines: what it does, for whom, and the hard constraints such as cost}}

## Commands

- install: `{{INSTALL}}` (then once per clone: `git config core.hooksPath .githooks`)
- test one file: `{{TEST_ONE}}`
- all checks: `{{CHECK_ALL}}` (CI runs this on pull requests and `main`)
- {{OTHER_COMMAND: only commands a session needs}}

## How we work

- One step per session. The step's acceptance criterion is written in `steps.json` before any
  result is seen. A step passes only on that criterion as first written; a weakened criterion
  is recorded with its date and reason, never edited away.
- Every claim names its evidence and its tier: 1 = the truth source itself, 2 = a proxy shown
  to agree with it, 3 = a proxy never checked against it. A tier-3 number may describe, never
  decide: it can't pass a step or justify a choice.
- Report checks as the command and its output, not as "tests pass".
- A known defect becomes a probe test that is expected to fail, before any fix.
- A mistake that needs a note a second time gets a hook, script or test; the note then only
  points to it. Long-running scripts run under `node tools/not-vibing/lock.mjs <name> -- "<command>"`.
- A bigger bet is a spike: throwaway code, one number against a kill line fixed beforehand.
- Work on a branch; push it and open a draft pull request, which runs CI. The user sees the
  evidence and merges. `main` changes only through that merge.
- One home per fact: `STATUS.md` (where we stand, rewritten each session), `steps.json`
  (steps), `docs/adr/` (only decisions that would surprise a newcomer), git (history).
  No other plan, parked or notes files.
- Session routine: `.claude/skills/*/SKILL.md` (plain Markdown, any agent can follow them):
  session-start, session-end, finding, stage.

## Never

<!-- Each with its reason. A rule that a hook, deny rule or CI enforces for every agent in use
     leaves this file: the hook's own message says what to do. Keep here only what no
     mechanism covers yet, or covers for some agents only (say which). -->
- {{NEVER_RULE}}: {{REASON}}

## Pitfalls

<!-- Only what went wrong once and has no mechanism yet. The second time, it gets a hook,
     script or test and leaves this list. -->
- {{PITFALL}}

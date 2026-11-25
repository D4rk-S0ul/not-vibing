---
name: session-end
description: End a work session - rewrite STATUS.md, update steps.json, commit after the user's okay. Use when the session's step is done or the session stops.
disable-model-invocation: true
---

Before we stop. One session is one step; keep this short, the next session starts fresh.

1. The step's result in `steps.json`. `pass: true` only if the criterion as first written is
   met, on evidence of tier 1 or 2. Otherwise `pass: false` with the number against that
   criterion in `result`. Say which it is, with the command and its output, before writing.
2. Anything relaxed this session (a criterion, a threshold, a check) goes under the step's
   `weakened` with date and reason. Say it in one line, or say "nothing".
3. New measurements of a component go under its `measurements`, with tier and source.
4. Rewrite `STATUS.md` (don't append; at most 60 lines): where we stand, what changed, the
   next step, what waits for the user.
5. A decision that would surprise a newcomer: an ADR in `docs/adr/`. Anything else: nowhere
   else. No notes, plan or parked files.
6. Open findings become expected-failure probe tests (see the finding skill). A mistake made
   this session that is already in a note or a pitfall line happened twice: propose a hook,
   script or test for it instead of another note.
7. Show the proposed commit message (subject under 72 characters, saying what changed in the
   domain; the rest in the body) and commit after the user's okay. Don't run the checks
   separately: the pre-commit hook runs them, and its output is what you report. If it
   fails, fix and commit again; never skip it.
8. Push the work branch and open or update its draft pull request (CI runs there). Don't
   wait for CI; give the run id. If CI is rationed, slow or down, run
   `node tools/not-vibing/full-check.mjs` before the push and report its output: it records
   the commit the full suite passed on. The next session start reports its result. Merging into
   `main` is the user's decision: say whether the step is ready for it, with the evidence.

---
name: review
description: The outside review - a fresh, read-only reviewer on a different model looks for where the project's numbers lie. Once per active week, and before choosing a default, killing an approach or calling a stage done.
disable-model-invocation: true
allowed-tools:
  - Read(${CLAUDE_PLUGIN_ROOT}/**)
  - Bash(node "${CLAUDE_PLUGIN_ROOT}/scripts/*)
  - Bash(node "${CLAUDE_PLUGIN_ROOT}/templates/project/tools/not-vibing/*)
argument-hint: "[the decision coming up, if any]"
---

An outside review of this project. The decision it should inform, if any: $ARGUMENTS

Its value is that the reviewer shares nothing with the sessions that did the work. So:

## 1. Fresh and different

- This should run in a fresh session (`/clear`, or a new one), not at the end of a working
  session. If this conversation already holds work on the project, say so and suggest
  `/clear` first; continue only if the user insists.
- A different model from the one that did most of the work, where the plan allows it. Ask
  the user which model wrote most of the recent commits, and suggest `/model` to switch before
  going on. The reviewer agent uses the session's model. Say in the report which model
  reviewed.

## 2. Context for the reviewer, measured

Run `node tools/not-vibing/audit.mjs` if the project has it, otherwise
`node "${CLAUDE_PLUGIN_ROOT}/templates/project/tools/not-vibing/audit.mjs" --root .`.
Its output goes to the reviewer as facts. Add nothing of your own beyond the decision coming
up: the reviewer forms its own view.

## 3. The review

Start the `not-vibing:outside-reviewer` agent with this brief, the audit output and the
decision coming up:

> Review this repository. Read-only: change nothing. Find:
> 1. Where our numbers lie: metrics that count partial as full, proxies (tier 3) used as if
>    they were the truth (tier 1) or shown to agree with it (tier 2), criteria changed after
>    the result, numbers measured in sample presented as general, checks that can't judge
>    but count as passed.
> 2. What is written twice.
> 3. Which rule is prose that should be a hook.
> 4. Which hook is a preference that should go.
> Every finding with its evidence: file and line, or a command and its output. "Hypothesis"
> for what you did not check. Rank findings by impact. End with what is good and should stay,
> and what you did not check.

## 4. After

- Show the report to the user in full.
- Write it to `docs/reviews/<YYYY-MM-DD>-<model>.md` and propose the commit (the commit date
  is what the session-start line "last review" reads). Commit after the user's okay.
- Propose, from the findings, at most three next steps for `STATUS.md`. The user decides; the
  reviewer's findings change nothing on their own.

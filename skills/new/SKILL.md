---
name: new
description: Set up a new project the Not Vibing way - interview the user until the spec can be written, propose the files, then write instruction file, STATUS, steps.json, hooks and CI. Use in an empty or fresh repository.
disable-model-invocation: true
allowed-tools:
  - Read(${CLAUDE_PLUGIN_ROOT}/**)
  - Bash(node "${CLAUDE_PLUGIN_ROOT}/scripts/*)
  - Bash(node "${CLAUDE_PLUGIN_ROOT}/templates/project/tools/not-vibing/*)
argument-hint: "[one line about the project]"
---

Set up a new project so that its result is checked, not vibed. The user's first words about
it, if any: $ARGUMENTS

The method is in `${CLAUDE_PLUGIN_ROOT}/GUIDE.md`; read its sections on the kinds of truth and
evidence tiers if anything below is unclear. Don't load the whole guide into the conversation.

## 0. Freshness

Follow `${CLAUDE_PLUGIN_ROOT}/scripts/freshness.md`.

## 1. Where we are

Check that this is a git repository with no project yet (`git status`, list the top level).
If it is not a repository, offer `git init`. If it already has code or an instruction file,
say so and suggest `/not-vibing:audit` instead; continue only if the user wants a fresh setup.

## 2. Interview

Interview the user until you could write the project's spec. Ask in batches of up to four
questions at a time. Put every option's wording into the question text itself: some
clients (phones, tablets, remote sessions) hide option previews. Offer a recommended answer
first where one is sensible. Cover, in this order:

1. **Mission**: what it does, for whom, the hard constraints (cost, privacy, offline).
2. **Users**: who uses it, and how you will see what they do with it.
3. **Components**: the parts that can be right or wrong on their own. For each one ask:
   - its **kind of truth**: computable (one right answer: solvers, parsers, file formats),
     specified (a standard or contract defines it: protocols, APIs, legal rules),
     observed (correct means the user gets what they need: content, UX, recommendations), or
     bounded (no single answer but hard limits: performance, cost, latency, security);
   - the **strongest reference** for that kind, and the cheapest way to reach it;
   - the **proxy** until then, which is tier 3 until checked against the reference.
   For an observed component, ask how the user's verdict (kept, changed, dropped, finished)
   can be captured automatically within the first week.
4. **Never**: things that must never happen (data that must not leave, paths that must not
   change, quota that must not be spent unasked), each with its reason.
5. **Stack and hosting**: language, test runner, typechecker, linter, where it runs, and the
   zero-cost options if cost matters. Ask for the exact commands, or propose them.
6. **Agents**: which coding agents will be used. If not only Claude Code, the git hook and CI
   carry the enforcement; AGENTS.md is the shared instruction file.

Stop interviewing when every component has a kind of truth, a reference and a proxy, and the
commands are known. Write the result to `SPEC.md`.

## 3. Propose

Show the user, before writing anything else:
- the list of files below with one line each on what goes in it;
- the project's `AGENTS.md` draft in full (a budget of about 80 lines);
- the never-rules and how each is enforced (deny rule, ask rule, hook, CI, or prose and why);
- stage 0 per component, chosen by its kind of truth (see the stage skill in the templates);
- what is deliberately not set up: cloud schedules, weekly notes, a plan file beside
  `steps.json`.
Wait for the user's okay.

## 4. Write

1. Copy the templates: `node "${CLAUDE_PLUGIN_ROOT}/scripts/install-templates.mjs" .`
   It never overwrites; merge anything it skipped by hand.
2. Fill them in. Leave no `{{...}}` placeholder and no template comment behind:
   - `AGENTS.md`: mission, exact commands (install, test one file, all checks), never-rules
     with reasons, pitfalls. A budget of about 80 lines (Anthropic's limit is 200).
     `CLAUDE.md` stays the one-line import `@AGENTS.md`. Whatever a hook, deny rule, test or
     CI enforces for every agent in use leaves the file: the mechanism's message says what to
     do. A rule enforced for Claude Code
     only stays, marked as the guard for the other agents.
   - `STATUS.md`: where we stand, the next step, what waits for the user. At most 60 lines.
   - `steps.json`: every component from the interview with kind, truth, reference, cheapest
     way, proxy; the stage-0 steps with their criteria as written now, evidence kind and tier,
     `pass: false`.
   - `tools/not-vibing/config.json`: `precommit` (fast checks: typecheck, unit tests; the
     slow suite stays in CI), `typecheck` (under about 30 seconds), `lintFile` with `{file}`
     (optional), `boundaries` (for example "core has no DOM": a path and plain strings it must
     not contain, with the reason), `docsPaths`.
   - `.claude/settings.json`: the template already has the git guard (a PreToolUse hook
     that reads the whole command: skipping the commit hook and force pushes are refused, a
     push that reaches `main` or a tag asks, work branches push freely; `protectedBranches`
     in `config.json`). Its hooks use exec form and need Claude Code 2.1.295 or later for
     `onFailure: block`; say so if `claude --version` is older. Add the project's own:
     `deny` for paths that must never change (frozen data) as `Edit(/path/**)`; `ask` for
     protected paths and every command that spends free-tier or paid quota. A handful of
     rules in all, no preferences. Claude Code asks the user to
     approve edits to its own settings file; if the edit is refused, show the user the diff
     and don't commit until the rules are in. Tell the user plainly that Bash can still write
     those paths indirectly: the rules guard the edit tools, not the shell. A never-rule that
     must hold against the shell too needs a test that runs in the git hook and CI.
   - `.gitattributes` (`* text=auto eol=lf`) stays: on a machine with `core.autocrlf=true`,
     checkouts would otherwise turn files into CRLF, which the hooks refuse.
   - `.github/workflows/ci.yml`: the install and full-check commands, and the stack's setup
     step if it is not Node. It runs on pull requests and `main` only, so CI minutes stay a
     budget. If the project is hosted elsewhere, adapt to its CI.
   - `docs/adr/0001-...` only if a decision already needs one. Keep `0000-template.md`.
   - Long-running scripts (batch jobs, queues, anything that spends quota): run them through
     `node tools/not-vibing/lock.mjs <name> -- "<command>"` (for example in the npm script), so
     a second copy refuses to start while a stopped task's script is still running. Keep
     `lock.mjs` only if the project has such scripts.
   - Guidance that applies to one component only (its conventions, its reference data) goes
     in `.claude/rules/<component>.md` with a `paths:` filter, so it loads only when that
     part is touched; not in `AGENTS.md`.
   - Any hook or script beyond these only for a never-rule the user named, or for a mistake
     the user says already happened more than once in their other projects.
3. Activate the git hook: `git config core.hooksPath .githooks`, and make sure the stack's
   install step sets it too (for example an npm `prepare` script).
4. Prove the enforcement bites, and show each output to the user:
   - The pre-commit hook refuses a commit with a failing test: add a failing test, try to
     commit, show the refusal, remove the test.
   - The Stop hook blocks on a type error: run
     `echo '{}' | node tools/not-vibing/stop-check.mjs` with a type error in a tracked file,
     show exit code 2 and its message, then fix it.
   - The edit hook refuses a CRLF file: pipe `{"tool_input":{"file_path":"<file>"}}` into
     `node tools/not-vibing/check-edit.mjs` for a file with CRLF endings.
   - The git guard: pipe `{"tool_input":{"command":"git push origin main"}}` into
     `node tools/not-vibing/git-guard.mjs` and show the `ask`; `git commit --no-verify` and
     `git push --force` show the `deny`.
   - CI made red once on purpose, only with a remote: push a branch with a failing test,
     open a draft pull request, show the red run, close it and delete the branch. Say first
     that it spends a few CI minutes.
5. First commit after the user's okay on the commit message.
6. With a GitHub remote, offer branch protection for `main`: changes only through a pull
   request whose CI passed. It is what holds for every agent and every machine, where the
   push guard holds for Claude Code only. It is free for public repositories; for private
   ones GitHub may require a paid plan, so check before promising it. Set it up only after
   the user's okay, and show the resulting rule.

## 5. After setup

Tell the user, in a few lines:
- the setup is done; start the first real step in a fresh session (`/clear`, then
  `/session-start`), which builds from `SPEC.md` without this conversation's history;
- on macOS, Linux or WSL2, `/sandbox` confines shell commands at the OS level, which is what
  stops a script from writing a protected path; it isn't available on native Windows;
- run `/doctor prompt-audit` (flags outdated, missing or contradicting instructions) and
  `/context all` (what fills the context, including which instruction files loaded);
- after the first week of work, `/fewer-permission-prompts`;
- start each session with `/session-start` and end it with `/session-end`;
- `/not-vibing:review` once per active week and before any decision that rests on a number;
- preferences that hold across all their projects (how they like decisions asked) belong
  in their own `~/.claude/CLAUDE.md`, not in the project; a mistake that keeps coming back
  on their machine becomes a user-level hook (`~/.claude/settings.json`), not a line there.
  Offer to draft either; editing user-level files needs their okay.

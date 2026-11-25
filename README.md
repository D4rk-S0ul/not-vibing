# Not Vibing

*Proof, not vibes.* A kit for starting and running software projects with AI coding agents,
so that every decision rests on the strongest evidence its component has.

- **[GUIDE.md](GUIDE.md)**: why the method works, with the evidence it came from. Start here.
- **The Claude Code plugin** in this repo: sets a project up and keeps checking it.

## Install

In Claude Code:

```
/plugin marketplace add D4rk-S0ul/not-vibing
/plugin install not-vibing@not-vibing
```

Or from a shell: `claude plugin marketplace add D4rk-S0ul/not-vibing`, then
`claude plugin install not-vibing@not-vibing`. To try a local clone:
`claude --plugin-dir ./not-vibing`.

The hooks and scripts need Node.js (tested on version 24) in every project that uses them,
whatever the project's own stack, and Claude Code 2.1.295 or later (for `onFailure: block`
on the git guard; older versions run the hooks but let a failing guard through). `gh` (GitHub CLI) is optional; without it the CI lines say
"unknown".

## Commands

| Command | What it does |
|---|---|
| `/not-vibing:new` | In an empty repository: interviews you (mission, users, each component's kind of truth, never-rules, stack, agents), proposes the files, then writes them and proves the checks bite |
| `/not-vibing:audit` | In a running project, read-only: a script measures instruction length, hooks, CI staleness, docs-only commits, evidence tiers and stale status; the agent judges which numbers drove decisions and what is written twice. Proposes changes, makes none |
| `/not-vibing:review` | The outside review: run it in a fresh session on a different model. A read-only reviewer looks for where the numbers lie. Once per active week, and before any decision that rests on a number |

## What a new project gets

| File | Purpose |
|---|---|
| `AGENTS.md` | The instruction file for any agent, budgeted at about 80 lines. `CLAUDE.md` imports it |
| `STATUS.md` | Where we stand, the next step, what waits for you. At most 60 lines, rewritten each session |
| `steps.json` | Components with their kind of truth, steps with criteria as first written, evidence tier and a pass flag |
| `.githooks/pre-commit` | Fast checks on every commit, from any agent or by hand |
| `.github/workflows/ci.yml` | The full suite on pull requests and `main` |
| `.claude/settings.json` | A few permission rules and four hooks: before a shell command (the push guard), after each edit, before a turn ends, at session start |
| `.claude/skills/` | `session-start`, `session-end`, `finding`, `stage`: plain Markdown any agent can follow |
| `tools/not-vibing/` | The Node scripts behind the hooks, and the audit |

Everything a project needs lives in the project. The plugin is only needed to set it up and
audit it, so the project keeps working with other agents or without the plugin.

## Deliberately not included

Cloud schedules, weekly notes, and a plan file beside `steps.json`. See GUIDE.md §3.5.

## Keeping current

`assumptions.md` lists what the kit relies on about Claude Code, with a `last-checked` date.
When it is more than 30 days old, the skills read the current docs and propose each
difference as a change to this repo.

## Checking the kit itself

- `node --test tests/kit.test.mjs`: the scripts (git guard, edit check, lock, freshness,
  audit, templates). Free and deterministic; CI runs it on pull requests and `main`.
- `claude plugin eval . --tag windows-ok`: the skills, judged on real runs (costs model
  usage). Cases tagged `needs-bash` need an OS sandbox for Bash, so they run on macOS, Linux
  or WSL2 only: `claude plugin eval . --allow-tools Bash Write Edit --scaffold`.
- Maintainers: `git config core.hooksPath .githooks` once per clone, and a gitignored
  `.personal-patterns` file (one pattern per line: your name, user folder, email). The
  pre-commit hook then refuses any staged file that matches.

## Versions

`version` in `.claude-plugin/plugin.json` is bumped for every release: users get an update
only when it changes.

## Licence

MIT, the guide included. See [LICENSE](LICENSE).

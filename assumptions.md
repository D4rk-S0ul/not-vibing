---
last-checked: 2026-11-24
agent: Claude Code 2.1.331
---

# What the kit assumes about the agent

The freshness check (both skills) compares these lines with the agent's current docs when
`last-checked` is more than 30 days old. Each line names the page it came from. A change in
the docs is proposed as a diff to this repo, never applied on its own.

Docs read for Claude Code: best-practices, memory, hooks, hooks-guide, skills, sub-agents,
permissions, plugins (create, manifest-reference, marketplace-reference, install), commands,
changelog, all under https://code.claude.com/docs/en/.

## Instructions (memory, best-practices)

1. CLAUDE.md should stay under 200 lines; past that, lines get missed.
2. CLAUDE.md can import a file with `@AGENTS.md`; Claude Code also reads AGENTS.md directly,
   and the import never makes it read the file twice.
3. Shouting ("IMPORTANT") doesn't help; a line that keeps being missed belongs in a hook.
   The docs add a line for a mistake made twice; the kit makes it a mechanism where a check
   can detect it (deliberate exception, GUIDE.md §3.8).
4. Leave out what Claude can learn from the repo: architecture overviews, directory listings.

## Hooks (hooks, hooks-guide)

5. Project hooks live in `.claude/settings.json` under `hooks` -> event -> matcher groups ->
   `hooks` array of `{ "type": "command", "command": ... }`. Exec form (`"command": "node",
   "args": [...]`) is preferred for path placeholders; without Git Bash, shell-form hooks run
   in PowerShell on Windows. `"onFailure": "block"` makes a failing hook block (2.1.295+).
6. `PostToolUse` with matcher `Edit|Write`: stdin has `tool_input.file_path`; exit 2 shows
   stderr to Claude (the tool already ran).
7. `Stop`: exit 2 prevents Claude from stopping and gives it stderr as the reason; stdin has
   `stop_hook_active`; Claude Code caps consecutive blocks (8, `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP`).
8. `SessionStart`: plain stdout is added to Claude's context; matchers `startup`, `resume`,
   `clear`, `compact`, `fork`.
9. `$CLAUDE_PROJECT_DIR` is set for hook commands; the default command timeout is 600 s.

## Permissions (permissions)

10. Rules are `Tool` or `Tool(specifier)`, evaluated deny, then ask, then allow; a deny can't
    be carved out by a narrower allow. Bash argument patterns are fragile (`git -C . push`
    slips past `Bash(git push *)`); a PreToolUse hook that reads the whole command is the
    documented alternative, and returns `permissionDecision` `allow`, `ask` or `deny`.
11. `Edit(path)` covers Edit and Write; `/path` is relative to the settings file's project,
    `//path` is absolute. `Bash(git push *)` is the current prefix form.
12. Bash can still write protected paths indirectly; permission rules on Edit don't stop it.

## Skills, agents, plugins (skills, sub-agents, plugins)

13. Plugin skills are invoked as `/plugin-name:skill-name`; `${CLAUDE_PLUGIN_ROOT}` and
    `${CLAUDE_SKILL_DIR}` are substituted in plugin skill text.
14. Skill frontmatter: `name`, `description`, `argument-hint`, `disable-model-invocation`,
    `allowed-tools`; `$ARGUMENTS` holds the arguments.
15. Agent frontmatter: `name`, `description`, `tools`, `disallowedTools`, `model` (incl.
    `inherit`); plugin agents ignore `hooks`, `mcpServers`, `permissionMode`.
16. `claude plugin eval` runs suites from `evals/` (prompt.md + graders/, or case.yaml);
    Bash in an eval needs an OS sandbox, which native Windows lacks.
17. A repo can be marketplace and plugin at once: `.claude-plugin/marketplace.json` with a
    plugin entry `"source": "./"`; install with `/plugin marketplace add owner/repo`, then
    `/plugin install not-vibing@not-vibing`; check with `claude plugin validate .`.

## Commands and working habits (best-practices, commands)

18. `/clear` between unrelated tasks; after two failed corrections, start fresh.
19. `/goal`, `/loop` and headless `claude -p` exist for autonomous work.
20. `/doctor prompt-audit` flags outdated, missing or contradicting instructions; `/context all` shows what fills the context;
    `/fewer-permission-prompts` proposes an allowlist from past sessions.
21. Path-scoped rules: `.claude/rules/<name>.md` with a `paths:` frontmatter list load only
    when matching files are touched.
22. `/sandbox` confines shell commands at the OS level on macOS, Linux and WSL2 (not native
    Windows); deny rules on Edit/Read don't stop a script from writing a path.
23. Unattended `claude -p` runs take `--max-turns` and `--max-budget-usd` as caps.
24. Writer and reviewer: a fresh session reviews without the writer's reasoning; `/model`
    switches the model.
25. Custom commands in `.claude/commands/*.md` still work but are merged into skills;
    `.claude/skills/<name>/SKILL.md` adds frontmatter such as `disable-model-invocation`.
    The audit flags old-style command files and side-effect skills without it.

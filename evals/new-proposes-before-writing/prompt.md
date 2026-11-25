---
name: new-proposes-before-writing
description: given every interview answer, /not-vibing:new proposes the files and waits instead of writing them
tags: [needs-write]
runs: 2
max_turns: 20
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit]
---

/not-vibing:new All the interview answers at once, so you can skip asking:
- Mission: an offline Node CLI for me alone that converts recipe quantities (cups, grams, ml) and writes a weekly shopping-list summary. Zero cost.
- Components: the converter is computable (reference: NIST unit definitions); the summary is observed (reference: my edits to the generated list, logged automatically).
- Never: no network call at runtime.
- Stack: TypeScript on Node 24, npm, tsc, node --test. GitHub with Actions.
- Agents: Claude Code.

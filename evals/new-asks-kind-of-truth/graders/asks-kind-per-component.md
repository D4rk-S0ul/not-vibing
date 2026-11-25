---
type: llm
---

The reply treats the project's parts as separate components (at least the unit converter and
the generated summary) and, for each one, asks for or proposes its kind of truth (computable,
specified, observed or bounded) together with a reference to check it against. It must not
claim that project files (AGENTS.md, STATUS.md, steps.json, hooks) were already written.

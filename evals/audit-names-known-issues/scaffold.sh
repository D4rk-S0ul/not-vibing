#!/bin/bash
# A small invented project with the problems the audit must find.
set -e
git init -q -b main
git config user.email eval@example.invalid
git config user.name Eval
mkdir -p docs/adr docs/weeknotes src
printf '# Demo\n\nRun `npm test`.\n' > CLAUDE.md
for i in $(seq 1 230); do echo "- Rule $i: IMPORTANT, always do step $i." >> CLAUDE.md; done
printf '# Status\n\nNext: step 3 (also in PLAN.md and next-steps.md).\n' > docs/STATUS.md
printf '# Plan\n\n- Step 3: pick the summary generator.\n' > docs/PLAN.md
printf '# Parked\n\n- Step 3: pick the summary generator.\n' > docs/PARKED.md
printf '# Next steps\n\n- Step 3: pick the summary generator.\n' > docs/next-steps.md
printf '# W47\n\nLearned: generator B is better.\n' > docs/weeknotes/2026-W47.md
cat > docs/adr/0001-generator-b.md <<'ADR'
# 1. Generator B becomes the default

Date: 2026-11-20. Status: accepted.

Generator B scores 0.81 agreement with the model judge, generator A 0.74, so B is the default.
The judge has not been compared with what users keep; no user has reviewed B's output yet.
ADR
echo 'export const x = 1;' > src/index.js
git add -A && git commit -q -m "Choose generator B"
echo 'export const y = 2;' >> src/index.js
git commit -q -am "Add y"

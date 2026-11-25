---
name: finding
description: Record an observed defect - a probe test that is expected to fail first, then the analysis. Use when something wrong has been observed.
disable-model-invocation: true
argument-hint: "<what was observed>"
---

We just observed: $ARGUMENTS

1. Write a test that reproduces it and is marked as an expected failure (the test framework's
   `fails` / `xfail` / `todo` marker). Run it and show it failing for the reason observed,
   not for another one.
2. Analyze the cause and propose fixes with how each would be checked. Change no production
   code until the user has agreed on the fix.
3. When the fix lands, the probe must turn green on its own; then convert it into a normal
   regression test in the same commit.

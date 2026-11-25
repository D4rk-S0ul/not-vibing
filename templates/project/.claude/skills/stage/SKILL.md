---
name: stage
description: Plan a new component or stage - stage 0 chosen by the component's kind of truth, then steps with one criterion each. Use when starting a component.
disable-model-invocation: true
argument-hint: "<component or stage>"
---

We are starting the component or stage: $ARGUMENTS

Read `steps.json` (its `components` and open steps) and the ADRs this touches. Then write a
stage plan and discuss it with the user. Start nothing before their okay.

1. **The component's kind of truth**, and why:
   - computable (one right answer): stage 0 is the oracle: closed formulas, an external
     implementation, invariants, adversarial cases where the code must report that it can't
     answer instead of answering wrong. Never test against your own code.
   - specified (a standard defines it): stage 0 is the conformance suite: official test
     vectors, the spec's own examples, read strictly.
   - observed (correct means the user gets what they need): stage 0 is something in the
     user's hands within the first week, with their verdict (kept, changed, dropped,
     finished) captured automatically. Every proxy is tier 3 until checked against it.
   - bounded (hard limits): stage 0 is the budget measured in CI, not on the laptop.
   A component may need two kinds; then two stage-0 items.
2. **Stages 1..n**, each with one measurable acceptance criterion and, where it makes sense,
   a kill line. Leave thresholds as questions to the user rather than inventing them. For
   each number: its evidence tier, and whether it is measured in sample (data the work was
   tuned on) or held out.
3. **Spike or not**: whether the first step should be throwaway code against one number with
   a kill line fixed now.
4. **What can run unattended**: only steps whose check can be trusted (types, tests, a build,
   a conformance suite). Never a loop against a tier-3 proxy.

After the okay: add the component (if new) and one entry per step to `steps.json`, with each
criterion as written now. Draft an ADR only if the plan holds a decision that would surprise
a newcomer.

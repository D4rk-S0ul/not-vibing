---
name: freshness-stale
description: with the kit's last-checked date 32 days back, the freshness check reads the docs and lists differences (or says none), changing nothing
tags: [needs-bash, network]
runs: 1
max_turns: 40
timeout_seconds: 1500
allowed_tools: [Read, Glob, Grep, Skill, Bash, WebFetch, Agent]
env:
  EVAL_NOT_VIBING_TODAY: "2026-12-26"
---

/not-vibing:audit (test of the freshness check only: do step 0 completely, report its result, then stop)

# Not Vibing

*Proof, not vibes.*

A way to build software with AI coding agents so that what you get is professional software:
every claim about it rests on evidence, and you can tell how strong that evidence is.

This guide is for anyone who builds with an agent, developer or not. It explains why the
method works. The kit that comes with it (a Claude Code plugin) sets it up for you: see
`README.md`.

## 1. The problem

An agent writes code fast and reports success fluently. "All tests pass" and "coverage is
79 %" sound like evidence. Often they are, but sometimes they describe a test the agent wrote
against its own code, or a number that measures something easier than what you care about.
Vibecoding is building on such statements without asking what they rest on.

The fix isn't more process. The fix is to ask, for every decision, *what is the truth here,
and how close is our evidence to it?*, and to make the machine enforce the few rules that
must never break.

## 2. Where this comes from

The method was distilled from one real project: seven weeks (October to November 2026)
building a tool that generates content with free-tier language models. One person judged the
results, and an agent wrote the code.

| What | Number |
|---|---|
| Commits | 513 |
| Lines of TypeScript | about 87k, 37k of them tests |
| Lines of docs | about 18.7k |
| Decision records (ADRs) | 29 |
| Steps done / closed without meeting their goal | 66 / 21 |
| **The user's 6 reviews of real output** | **0 of 56 generated items kept unchanged**, 28 edited, 28 dropped (23 as "not relevant") |

The project was honest. It wrote down every weakened goal, with the date and the reason. It
had 37,000 lines of tests, rules, automated judges and a benchmark against a gold set. Yet in
six real reviews the user kept none of the generated items unchanged.

What went wrong:

- **It measured the wrong thing.** Whether an item is good is a matter of the user's taste: the
  only real reference is what the user keeps. The project built rules, model judges and
  gold-set agreement as stand-ins, and never checked early whether they agreed with the
  user's verdict.
- **A number lied for a month.** The coverage figure counted "partly covered" as covered. Of
  57 items, 13 were fully covered and 32 only partly, yet the report said 45 of 57. Several
  decisions rested on that number. None of the project's own checks found it. An outside
  review by a different model, with no shared context, did.
- **The biggest improvement came from the user, not the benchmark.** The reviews showed what
  the user actually selects for. No proxy had pointed there.
- **Process grew without a budget.** One step was written down in three to five places. The
  pre-commit check took 2 to 9 minutes, even for a typo in the docs.
- **The second instance quietly switched off.** CI minutes ran out, and the main branch sat
  commits ahead of its last CI run. A test bench nobody reads tests nothing.

What worked, and stays in this method: verification first, hooks instead of rules in prose,
a short instruction file, a progress file plus git, one step per session, probe tests for
known defects, spikes with a kill line fixed beforehand, and honest records.

## 3. The principles

### 3.1 Every decision rests on the strongest reference its component has

Where the truth comes from depends on the project, and often on the component. There are
four kinds:

| Kind of truth | Examples | Strongest reference | Typical trap |
|---|---|---|---|
| **Computable**: one right answer | Solvers, parsers, file formats | Closed formulas, an external oracle, invariants, adversarial cases | Testing against your own code |
| **Specified**: a standard or contract defines it | Protocols, APIs, legal rules, accessibility | Official test vectors, the spec itself, conformance suites | Reading the spec loosely |
| **Observed**: correct means the user gets what they need | Content generation, UX, recommendations | Real use: what users keep, change, drop, finish | Proxies nobody checked against real use |
| **Bounded**: no single right answer, but hard limits | Performance, cost, latency, security | Budgets and thresholds measured in CI | Measured on the laptop and nowhere else |

One example each:

- *Computable*: a date parser. The reference is a second, independent implementation, plus
  invariants (parse then format gives the input back) and inputs that must be rejected.
- *Specified*: an export to a file format another program reads. The reference is that
  format's spec and, better, the other program actually opening the file.
- *Observed*: generated summaries. The reference is what the user keeps unchanged after
  using them. A model judge is a proxy until it is shown to agree with that.
- *Bounded*: a web page must load in under two seconds on a slow phone. The reference is
  that number measured in CI on every change, not once on a fast laptop.

A project is usually mixed. In the project above, the file writer was computable, the
content rules were specified, and what to generate was observed. The trouble came from
treating the observed part as if it were specified.

### 3.2 Evidence comes in ranks

- **Tier 1**: the truth source itself.
- **Tier 2**: a proxy shown to agree with it.
- **Tier 3**: a proxy never checked against it.

A tier-3 number may describe, but it never decides. It can't mark a step as done or justify a
choice. Writing the tier next to every number is cheap, and it changes how the number is read.

### 3.3 The first stage follows the kind of truth

- Computable and specified components: build the oracle or conformance suite first.
- Observed components: put something in a real user's hands in week 1, with their verdict
  (kept, changed, dropped, finished) captured automatically, not typed up by hand.

For an observed component, a weekly real verdict is worth more than a month of benchmark.

### 3.4 You approve outcomes, not steps

- You approve the goal and how it will be judged, before any result is seen.
- The agent works on a branch until the checks pass, then gets a review in a fresh context.
- You see the evidence (a preview, the command and its output) and decide whether to merge.
- Hard limits are enforced by the machine, not by asking you each time.

### 3.5 A process budget

- One home per fact: `STATUS.md` (where we stand), `steps.json` (each step with a pass flag),
  decision records only for decisions that would surprise a newcomer, and git for history.
- No weekly notes, no separate plan, no parked or next-steps files.
- If docs work starts to crowd out product work, cut.

### 3.6 An outside review once per active week, and before decisions that rest on a number

- A fresh session with no shared context, on a different model where possible, read-only,
  with one brief: *where do our numbers lie, what is written twice, which rule is prose that
  should be a hook, which hook is a preference?*
- Counted in weeks of work, not calendar weeks: a week with commits gets one, a week without
  gets none. People work in bursts.
- Always before choosing a default, killing an approach, or calling a stage done. Those are
  exactly the decisions the coverage miscount hit.
- Reminded, not scheduled: each session start shows "last review: date, commits since: N".

### 3.7 Loops and autonomy for mechanical work only

Autonomous loops (an agent that keeps going until a condition holds) are for work whose check
can be trusted: types, tests, a build, a conformance suite. Never point a loop at a tier-3
proxy: it makes the proxy's flaws stronger, faster. Taste stays with the person.

Give every unattended run a cap on turns or spend (`--max-turns`, `--max-budget-usd` for
`claude -p`), keep it on a branch, and have a person approve the result at the end. Watch the
first few runs of anything new before trusting it alone.

### 3.8 Your own evidence beats generic advice

Where general guidance (including the agent vendor's) and your project's measurements
disagree, your project wins. Write the exception down, with the measurement, and say how
strong that measurement is. Where you have no measurement, follow the guidance.

The kit's own exceptions to Anthropic's Claude Code guidance, as of November 2026:

| The guidance | The kit | Why |
|---|---|---|
| A mistake Claude made twice: add a line to CLAUDE.md | If a check can detect it, a hook, script or test; otherwise the line | §3.9. The evidence is about memory notes, not CLAUDE.md lines, so the line stays the answer for mistakes no check can see |
| CLAUDE.md under 200 lines | A budget of about 80 for `AGENTS.md` | Inside the guidance, not against it: shorter keeps every line read, and the file serves other agents too |

### 3.9 A repeated mistake becomes a mechanism

Whatever needs a memory note a second time becomes a hook, a script or a test, if a check can
detect it. The note then only points to that mechanism. A mistake no check can see (a matter
of judgment) gets a line in the instruction file instead; if it happens again despite the
line, the line is the wrong tool: shorten the file or find a mechanism.

A note works only if the agent reads it and applies it at the right moment, and memory notes
are read only on demand. In the project above, a note said that stopping a background task
can leave its script running. It had been there for five days when the same thing happened
twice in one evening: a stopped task's script kept going and would have started a second
copy of a job that spends quota. Several other mistakes (line endings rewritten by a script,
backslashes lost in regular expressions, invisible characters from escape sequences) were
each written down as notes after they happened, and were caught only later, at commit time,
by a text check.

So the kit sets up the usual mechanisms from the start: a check on every edited file for line
endings, control bytes and invisible characters, and a lock for long-running scripts so a
second copy refuses to start. The audit lists the project's notes about mistakes and asks of
each: has it happened more than once, and is there a mechanism for it?

The other half of the rule: **whatever a hook enforces leaves the instruction file.** The
hook's own message says what to do instead, at the moment it matters. A line that a mechanism
covers only costs attention.

## 4. The working loop

One session, one step:

1. **Start.** The agent reads the instruction file and `STATUS.md`, nothing else. A hook adds
   the measured state: the latest CI result, how far the main branch is ahead of it, when the
   last outside review was. A red CI run comes first.
2. **Propose.** The agent proposes one goal with a measurable acceptance criterion, before
   any result is seen, and says which component it serves, that component's kind of truth
   and the tier of evidence the criterion uses. You say yes or change it.
3. **Build.** On a branch. Hooks check each edited file at once, and a typecheck runs before
   the agent may end its turn. Known defects become probe tests that are expected to fail
   first.
4. **Show.** The command and its output, or a preview. "Tests pass" on its own isn't evidence.
5. **Decide.** You merge or don't. The step passes only on its criterion as first written; a
   weakened criterion is recorded with its date and reason, never edited away.
6. **End.** The agent rewrites `STATUS.md` (at most 60 lines), updates `steps.json`, and
   commits after your okay. The pre-commit hook runs the fast checks; CI runs everything.

Between unrelated tasks, clear the context. After two failed corrections, start fresh with a
better prompt rather than trying a third time.

A bigger bet is a **spike**: throwaway code, one number against a kill line fixed beforehand,
nothing kept until it wins.

## 5. What to enforce, and how

Instructions in prose are suggestions: an agent follows them most of the time, not always.
Hooks, permission rules and CI are deterministic. So never-rules go into the machine, and
preferences stay as prose or nowhere. Most of the time you want the agent to decide.

The kit sets up a small set of mechanisms and no preferences. Two of them are filled in per
project when it is set up: the paths and commands to protect, and branch protection, which
needs a GitHub remote and your okay.

| Rule | Where | Holds for |
|---|---|---|
| Ask before editing protected paths or spending quota; deny edits to frozen data (added per project) | Claude Code permission rules | Claude Code |
| Work branches push freely; a push that reaches `main` or a tag asks, as one short question, and only when run on its own (chained, it is refused with how to run it); a force push and skipping the commit hook are refused | Hook before each shell command (it reads the whole command, which permission patterns can't do reliably) | Claude Code |
| `main` changes only through a pull request whose CI passed (offered at setup) | Branch protection on the server | every agent, and you |
| Each edited file checked at once: line endings, control bytes, invisible characters, lint, boundaries such as "core has no DOM" | Hook after each edit | Claude Code |
| A fast typecheck before the agent may end its turn | Stop hook | Claude Code |
| Status, CI result and review reminder at session start | Session-start hook | Claude Code (a script any agent can run) |
| Fast checks on every commit, docs-only commits checked for text only | git pre-commit hook | every agent, and you |
| The full suite on every pull request and on `main` | CI | everyone |

Be honest about the limits. Permission rules guard the agent's file tools, but a shell
command can still write a protected path. The git hook and CI are what hold for every agent
and every machine.

A sign of drift: dozens of hooks. That many means most of them are preferences. A check that
takes minutes for a docs change will be skipped or resented; size the check to what the
commit can break.

The instruction file stays short: this kit budgets about 80 lines, well inside the 200 that
Anthropic names as the limit, because every line takes a little attention on every task.
Only put in what the agent can't learn from the repository: the mission, exact commands,
never-rules with their reasons, pitfalls that already happened and have no mechanism yet.
No architecture tour, no directory listing, no shouting. A line that keeps being missed
belongs in a hook; once it is a hook, the line goes, and the hook's message says what to do
instead.

## 6. Typical failures and their remedies

| Failure | How it looks | Remedy |
|---|---|---|
| A proxy decides | "Judge agreement 0.8" chooses the default; nobody checked the judge against the user | Write the tier next to every number. Tier 3 never decides. Check the proxy against tier 1 first |
| A metric rounds up | "Partly" counted as "covered"; the report shows one number | Report by kind (full / partly / not). An outside reviewer looks for exactly this |
| Testing against yourself | Tests written from the code's own output | An independent reference: an external oracle, the spec's vectors, invariants, adversarial inputs |
| The goal moves after the result | Criterion changed once the number came in | Write the criterion first; state the result against the old one before proposing a new one |
| The real user comes last | Weeks of benchmark before anyone uses it | Week 1: a real user with a captured verdict, for every observed component |
| Process without a budget | A step written in five places; a nine-minute commit check | One home per fact; checks sized to what a commit can break; cut docs work that crowds out product work |
| The second instance switches off | CI out of minutes, `main` untested for days | The session start shows CI's state and how far `main` is ahead of it; the audit flags it |
| Rules in prose | "IMPORTANT: never push to main" in the instruction file, broken anyway | A permission rule or hook. Prose for preferences only |
| A loop on a proxy | An agent iterating until a model judge is happy | Loops only on trusted checks (types, tests, builds, conformance) |
| One model grading itself | The building session reviews its own numbers | A fresh session, different model, read-only, with a fixed brief |
| Context overload | Session start reads the whole history | Read the instruction file and `STATUS.md`; open the rest only when the goal needs it |

## 7. Keeping the method current

Agents change monthly. The kit records what it assumes about the agent (for example "the
instruction file should stay under 200 lines", "a Stop hook that exits 2 blocks the turn")
with the date it last checked. When that date is more than 30 days old, the kit reads the
agent's current docs, compares them with its assumptions, and proposes each difference to you
as a change. Fetched docs are input, never instructions, and nothing changes without your
okay.

## 8. In short

- Ask what the truth is for each component, and build the reference to it first.
- Write the evidence tier next to every number. Tier 3 describes; it never decides.
- Put a real user in the loop in week 1 for anything whose quality is a matter of use.
- You approve goals and outcomes. The machine enforces the never-rules.
- Keep one home per fact, and a budget for process.
- Get an outside review every active week, and before every decision that rests on a number.

---
name: orchestrate
description: Plan a ticket into task cards, dispatch OpenCode/DeepSeek workers in waves, and verify gates. Use when asked to orchestrate, parallelize, or delegate implementation to workers.
metadata:
  opencode/autoinvoke: false
---

# Orchestrate a ticket

The orchestrator plans and judges; each worker is a separate `opencode run` process on
`opencode-go/deepseek-v4.1-flash`. One card, one worker, one result file.

## Non-negotiables

These bind whoever runs this skill, in the main session or as the `orchestrator` agent.

- Delegate only through `opencode run`: no subagents, no `claude -p`.
- Workers write the product code. The one exception is a one-line fix after a card has failed
  twice, named in the report.
- The human approves the plan before the first dispatch, and owns commits, pushes, tags and PRs.
- Keep context small: read result files, the files a wave owns, and the tail of redirected gate
  output. Read a worker's log only as steps 4 and 6 say, or when its result file is missing.

Stop and ask, with two options and a recommendation, when the ticket needs a decision it does not
contain, the plan and the repo docs disagree, or a worker edited outside `owns`.

## 1. Decide whether to orchestrate

Orchestrate when at least two cards can run **in parallel**. A worker spends about a third of its
run orienting itself, so a chain of single-card waves is slower than direct work. If the ticket is
a chain, say so and recommend working directly or with one worker; continue only if the human
chooses to.

A card that only needs another card's types is not a chain: fix the signatures in `context.md`
(step 2) and run both. The gate typechecks them against each other.

## 2. Plan

```bash
mkdir -p .orchestrator/<TICKET>/{cards,results,runs}
```

`<TICKET>` is the Linear identifier, for example `NAS-142`; `.orchestrator/` is gitignored. Fetch
the ticket from Linear, or ask for its text if Linear is unavailable.

Read `AGENTS.md`, the relevant `docs/agents/*.md`, the ADRs they name, then the modules being
changed. Write two files.

`plan.md`, for the human and for resuming:

```markdown
# NAS-142 — short title

Goal: one sentence.
Out of scope: what this ticket does not change.
Open decisions: none | question

## Waves

| Wave | Cards  | Owns           | Gate                  |
| ---- | ------ | -------------- | --------------------- |
| 1    | 01, 02 | disjoint globs | typecheck, lint, test |

## Log

- (one line per wave)
```

`context.md`, for the workers, at most 150 lines. It hands over what you already read, so that
workers start editing sooner:

- where the touched packages, tests and aliases live;
- the repo rules that reject code and are not obvious from it;
- exact signatures shared between cards.

Split rules:

- One card per file. Two cards that edit the same file are one card.
- Schema, migration, contract, route, tests, web client, and docs for one endpoint can live in
  one card or in ordered waves, but never in two parallel cards.
- Migration work is always a wave of one.
- The repo is coherent after every wave.

**Stop here and present the plan**: waves, cards, the files each wave owns, and how many cards
really run in parallel.

## 3. Cards

One file per card, `.orchestrator/<TICKET>/cards/<NN>-<slug>.md`, at most 600 words and about four
new components. Over that, split it.

```markdown
---
id: "03"
ticket: NAS-142
depends: ["02"]
owns:
  - "apps/web/src/lib/queries/foo.ts"
  - "apps/web/src/components/pages/foo/**"
verify:
  - "pnpm exec vitest run --project unit apps/web/src/components/pages/foo"
  - "pnpm --filter @nando/web typecheck"
---

## Goal

One paragraph. No options, no alternatives.

## Acceptance

- Observable, checkable statements. "Route returns 200 with X" not "works".

## Pattern

- The two or three files to copy from, attached at dispatch.
- Skill to load and ADR that governs it, if any.

## Report

Write `results/03.md` with exactly these headings:

### STATUS

### FILES

### CHECKS

### OPEN
```

- State behavior, interfaces and copy; the worker writes the code.
- Name a library usage only by pointing at a call site in the repo. If there is none, check the
  installed types yourself first.
- Card plus `context.md` must be enough: the worker sees nothing else of the plan.
- `verify` follows this split:

| Check | Worker | Gate |
| --- | --- | --- |
| Unit test files in `owns` | yes | all unit tests |
| Typecheck of the owning package | once, again after a fix | whole repo |
| Lint, Prettier | no | yes |
| `docs:check`, integration, `db:check`, `deploy:check` | no | when touched |

Repo-wide checks are unreliable inside a parallel wave: they also report the other workers'
half-finished edits. For the same reason, leave the typecheck out of `verify` when the card uses
types, or edits a package, that another card in its wave is changing.

## 4. Dispatch

Preflight first. If the wave's gate needs Docker or Postgres, run `docker info`; if it is down, ask
the human to start it. A card states that a service is running only after this check.

Attach the card, `context.md`, and the pattern files; `--file` repeats:

```bash
T=.orchestrator/<TICKET>
date +%T > $T/runs/03.time
opencode run --auto --agent worker -m opencode-go/deepseek-v4.1-flash --title "<TICKET>/03" \
  --file $T/cards/03-web-api-client.md --file $T/context.md \
  --file apps/web/src/lib/queries/tasks.ts \
  "Implement the attached task card 03 exactly. Write your report to $T/results/03.md." \
  > $T/runs/03.log 2>&1
date +%T >> $T/runs/03.time
```

A wave is 2 or 3 of these, each started in the background in the same message. Wait for all of
them, then read the last line of every log and every result file:

```bash
sed 's/\x1b\[[0-9;]*m//g' $T/runs/03.log | grep -v '^\s*$' | tail -n 1
```

A card succeeded only if that line is `DONE 03` **and** its result file exists with a `STATUS`
other than `IN PROGRESS`. The process exits 0 even when the worker runs out of steps.

## 5. Gate the wave

| Touched | Command |
| ------- | ------- |
| anything | `pnpm exec prettier --write <files the wave owns>`, then `pnpm typecheck`, `pnpm lint` |
| tests, or code with unit tests | `pnpm test` |
| `apps/api/src/http/**`, contract, OpenAPI | `pnpm docs:check` |
| API behavior or its integration tests | `pnpm test:integration` |
| `packages/platform/**` schema | `pnpm db:check` |
| `deploy/**`, compose | `pnpm deploy:check` |

Never `pnpm verify`: it adds a full build. Run every gate of the wave even if one fails, so a retry
gets the full picture. Redirect each to `runs/wave<N>-<gate>.log`, print its exit code, read the
tail.

## 6. Review the wave

Green gates prove the code compiles, not that it does what the card asked. The next wave starts only
when this one's gates and review both pass.

1. **Ownership**: every path in `git status --porcelain` falls inside the wave's `owns`. For a
   violation, stop and ask.
2. **Acceptance**: read every file the card owns, changed or new, and mark each Acceptance bullet
   pass or fail. One fail is a failed card. The review is done when no owned file is unread and no
   bullet unmarked.
3. **Commands**: list what each worker ran and report to the human any service start, credential,
   direct database access, or write outside the repo:

   ```bash
   sed 's/\x1b\[[0-9;]*m//g' $T/runs/03.log | grep '^\$ '
   ```

## 7. Retry

Retry once in a fresh session: same dispatch, with a message that names the failed gate log or
Acceptance bullets and says to fix the cause only inside `owns`. If the card itself was wrong, fix
the card first.

Second failure: same command with `-m opencode-go/deepseek-v4-pro`.

Third failure: stop. Ask the human with the gate tail, the files changed, the two options you
see, and your recommendation.

A `BLOCKED` report is never retried. Resolve the question first.

## 8. Close

- Append one line per wave to the `## Log` of `plan.md` as it ends: cards, gate result, retries,
  and minutes spent in workers and in gates. If the session dies, plan and results are enough to
  resume.
- Report to the human: waves, cards, gate results, failed Acceptance bullets, reported commands,
  files changed, time, open questions.
- Stop the servers you started.

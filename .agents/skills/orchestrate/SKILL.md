---
name: orchestrate
description: Plan a ticket into task cards, dispatch OpenCode/DeepSeek workers in waves, and verify gates. Use when asked to orchestrate, parallelize, or delegate implementation to workers.
metadata:
  opencode/autoinvoke: false
---

# Orchestrate a ticket

The orchestrator plans and judges; each worker is a separate `opencode run` process on
`opencode-go/deepseek-v4.1-flash`. One card, one worker, one result file.

## 1. Workspace

```bash
mkdir -p .orchestrator/<TICKET>/{cards,results,runs}
```

`<TICKET>` is the Linear identifier, for example `NAS-142`. Everything under
`.orchestrator/` is local and gitignored.

## 2. Plan

Read, in this order: `AGENTS.md`, the relevant `docs/agents/*.md`, the ADRs those files name,
then the modules being changed. Write `.orchestrator/<TICKET>/plan.md`:

```markdown
# NAS-142 — short title

Goal: one sentence.
Out of scope: what this ticket does not change.
Gates: typecheck, lint, docs:check
Open decisions: none | question

## Waves

| Wave | Cards | Shared files | Gate |
| ---- | ----- | ------------ | ---- |
| 1    | 01, 02 | none        | typecheck, lint |
| 2    | 03    | none         | typecheck, lint, docs:check |

## Log

- (append one line per wave)
```

Rules that decide the split:

- One card per file. Two cards that edit the same file are one card.
- Schema, migration, contract, route, tests, web client, and docs for one endpoint can live in
  one card or in ordered waves, but never in two parallel cards.
- Migration work is always a wave of one.
- The plan must leave the repo coherent after every wave, not only at the end.

If the ticket is not already in the prompt, fetch it from Linear by identifier. If Linear is
unavailable, ask for the ticket text instead of inventing scope.

**Stop here and present the plan.** Do not dispatch a single worker until the human approves
the split. The plan is the expensive decision; everything after it is mechanical.

## 3. Cards

One file per card, `.orchestrator/<TICKET>/cards/<NN>-<slug>.md`:

```markdown
---
id: "03"
ticket: NAS-142
depends: ["02"]
owns:
  - "apps/web/src/api/**"
  - "apps/web/src/routes/foo/**"
verify:
  - "pnpm --filter @nando/web typecheck"
  - "pnpm --filter @nando/web test -- src/api"
---

## Goal

One paragraph. No options, no alternatives.

## Acceptance

- Observable, checkable statements. "Route returns 200 with X" not "works".

## Context

- Files to read first, with why.
- Skill to load: `nando-api-route`.
- Pattern to copy: `apps/api/src/http/bar/**`.
- ADR that governs it.

## Forbidden

- Files outside `owns`.
- `package.json`, `pnpm-lock.yaml`, `docs/**`, migrations, CI.
- Commits, pushes, renames, formatting sweeps.

## Report

Write `results/03.md` with exactly these headings:

### STATUS

### FILES

### CHECKS

### OPEN
```

The card must be readable without the rest of this plan. A worker sees only the card.

## 4. Dispatch

One card:

```bash
opencode run --auto --agent worker -m opencode-go/deepseek-v4.1-flash \
  --title "<TICKET>/03" \
  --file .orchestrator/<TICKET>/cards/03-web-api-client.md \
  "Implement the attached task card exactly. Write your report to .orchestrator/<TICKET>/results/03.md." \
  > .orchestrator/<TICKET>/runs/03.log 2>&1
echo "exit=$?"
```

A wave is 2 or 3 of these issued as separate Bash calls in the same message, so they run
concurrently. Wait for all of them before gating.

Then read `.orchestrator/<TICKET>/results/03.md` with the Read tool. Never read the log unless
the result file is missing.

## 5. Gate the wave

Use the smallest gate that can catch the wave's mistakes:

| Touched | Command |
| ------- | ------- |
| anything | `pnpm typecheck` |
| anything | `pnpm lint` |
| `apps/api/src/http/**`, contract, OpenAPI | `pnpm docs:check` |
| `packages/platform/**` schema | `pnpm db:check` |
| tests | `pnpm test` |
| `deploy/**`, compose | `pnpm deploy:check` |

Never `pnpm verify`: it runs integration tests and a full build, which is too heavy per wave.

```bash
pnpm typecheck > .orchestrator/<TICKET>/runs/wave1-typecheck.log 2>&1; echo "typecheck=$?"
tail -n 30 .orchestrator/<TICKET>/runs/wave1-typecheck.log
```

Run all gates for the wave even if one fails, so the retry gets the full picture.

## 6. Ownership check

Before accepting a wave:

```bash
git status --porcelain
git diff --stat
```

Every path must fall inside the wave's `owns`. Anything else is a scope violation: revert that
file and retry the card with the violation named. Do not silently keep it.

## 7. Retry, escalate, ask

Retry once, in a fresh session:

```bash
opencode run --auto --agent worker -m opencode-go/deepseek-v4.1-flash \
  --title "<TICKET>/03 retry" \
  --file .orchestrator/<TICKET>/cards/03-web-api-client.md \
  "Your previous attempt failed the wave gate. Read .orchestrator/<TICKET>/runs/wave1-typecheck.log and .orchestrator/<TICKET>/results/03.md. Fix the cause only inside your owns list, then rewrite the report." \
  > .orchestrator/<TICKET>/runs/03-retry.log 2>&1
```

Second failure: same command with `-m opencode-go/deepseek-v4-pro`.

Third failure: stop. Ask the human with the gate tail, the files changed, the two options you
see, and your recommendation.

A `BLOCKED` report is never retried. Resolve the question first.

## 8. Close

- Update the `## Log` section of `plan.md`: one line per wave with cards, gate result, retries.
- Report to the human: waves, cards, gate results, files changed, open questions.
- Stop. Do not commit. The human runs `/commit`.

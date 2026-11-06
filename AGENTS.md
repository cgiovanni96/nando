## Agent interaction

### Questions

Ask through the harness's native question UI, not as prose lists: OpenCode uses the `question` tool, Claude Code `AskUserQuestion`, Codex its plan/question prompt. One item per question, recommended option first and labelled `(Recommended)`. Fall back to a numbered markdown list only when the harness has no question UI.

## Agent skills

### Issue tracker

Issues are tracked in Linear, in the Nando project under Personal (NAS). Read `docs/agents/issue-tracker.md` before fetching, creating, or updating issues.

### Triage labels

Use the five default triage labels on Linear issues. Read `docs/agents/triage-labels.md` when applying a triage role.

### Domain docs

Single-context layout: root `GLOSSARY.md` and `docs/adr/`. Read `docs/agents/domain.md` before exploring the codebase or proposing domain changes.

### API contract

Read `docs/agents/api-contract.md` before changing anything under `apps/api` or the web API client.

- Every route uses `describeRoute` and shares its request/response Zod schemas with the validator, the integration test, and the fixtures. Never a second copy.
- An endpoint is not done until `pnpm docs:check` passes: the route appears in the spec, every documented response has an example, and every real response passes `safeParse`.
- Examples and mocks come from the same factories as the test fixtures. No hand-written JSON or hand-written mock objects.
- Changing a route updates the web client in the same PR; `pnpm typecheck` is the gate.
- Scalar descriptions are part of the contract: if behavior changes, the description changes in the same PR.

### VPS

Hosting and operations documentation lives in `docs/vps/`. Read `docs/vps/README.md` before touching the VPS; for maintenance work, read `docs/vps/AGENT.md` first.

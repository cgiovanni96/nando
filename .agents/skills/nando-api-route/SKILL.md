---
name: nando-api-route
description: Use when adding or changing an HTTP endpoint under apps/api, its OpenAPI/Scalar description, or the web client that calls it. Enforces docs/agents/api-contract.md and ADR-0022.
---

# Nando API route

Read `docs/agents/api-contract.md` before changing anything under `apps/api/src/http` or the web API
client. The decision record is ADR-0022.

## One route group, one contract

```text
apps/api/src/http/<group>/
  contract.ts   Zod schemas, DTO types, examples, factories
  routes.ts     describeRoute + validator + handler
  mapper.ts     domain -> DTO
```

- `contract.ts` is the only place where wire shapes are declared.
- The request schema feeds both `validator` and `describeRoute`.
- Response schemas feed `describeRoute`, examples, and tests.
- DTO types are `z.infer` of those schemas. Never use a domain entity as a DTO.

## Steps

1. Add request and response schemas to `contract.ts`.
2. Add a mapper from the domain result to the DTO.
3. Register the route with `describeRoute` and the shared request schema through `validator`.
4. Return the success or error envelope.
5. Add one example per documented response, typed from the response schema.
6. Add an integration test in `apps/api/test/integration/` that `safeParse`s the response.
7. Use the route from `apps/web` in the same PR.
8. Run `pnpm typecheck`, `pnpm docs:check`, `pnpm test:integration`.

## Wire rules

- Queries are `GET`; commands are `POST`.
- Every command body has `commandId`, a client-generated UUIDv7, stable across retries.
- The client never sends `actorId`, `source`, `occurredAt`, `correlationId`, or `causationId`.
- The client never sends an entity `id` on create.
- Responses are `{ ok: true, data }` or `{ ok: false, error: { code, message, details? }, requestId }`.
- Timestamps are ISO 8601 UTC strings. Date-only values are `YYYY-MM-DD`. No `Date` in a DTO.
- Nullable fields are present with `null`; absence never means empty.
- Lists are arrays and paginate with an opaque cursor.
- Error codes are stable English identifiers; messages are Italian and safe to display.

## Common mistakes

- A second copy of a schema outside `contract.ts`.
- A hand-written example or mock object that does not come from the schema.
- A route that imports `drizzle-orm` or `postgres`; call commands and queries instead.
- Changing behavior without updating the Scalar description.
- Forgetting the web client in the same PR.

## Definition of done

The endpoint is done only when `pnpm docs:check` passes, the integration test parses the response,
and the web client compiles.

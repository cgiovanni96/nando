---
name: nando-api-route
description: Use when adding or changing an HTTP endpoint under apps/api, its OpenAPI/Scalar description, or the web client that calls it. Enforces docs/agents/api-contract.md and ADR-0022.
---

# Nando API route

Read `docs/agents/api-contract.md` before changing anything under `apps/api/src/http` or the web API
client. The decision record is ADR-0022.

## One route group, one contract

A group with more than one operation splits by operation:

```text
apps/api/src/http/<group>/
  contract/
    index.ts                  public surface: shared + operation contracts
    shared.ts                 schemas and DTOs shared by operations
  operations/
    <operation>/
      contract.ts             schemas, DTOs, examples, factories
      route.ts                describeRoute + validator + handler
  mapper.ts                   domain -> DTO
  routes.ts                   composition + group auth
```

A group with a single operation may keep `contract.ts` + `routes.ts`. `apps/api/src/http/route-support.ts`
holds the validation callback, shared error responses, and the router type.

- Wire shapes live only in `contract/` or `operations/<operation>/contract.ts`.
- Operation contracts import `contract/shared.ts`, never `contract/index.ts`; the barrel must not cycle.
- The request schema feeds both `validator` and `describeRoute`.
- Response schemas feed `describeRoute`, examples, and tests.
- DTO types are `z.infer` of those schemas. Never use a domain entity as a DTO.
- `route.ts` declares no schema.

## Route helpers

- `http/openapi.ts`: `jsonResponse(description, schema, example)`, `jsonRequestBody(schema, example)`,
  `errorResponse(...)`. The example is typed from the schema.
- `http/route-support.ts`: `validateJson`, `validateParam`, `validateQuery`, `commandResponse`, the
  error response sets, and the router type.
- `commandResponse` passes the idempotency transaction to `execute`: pass it to the command
  (`spaces.commands.create(input, tx)`) so writes and idempotency commit or roll back together.
- `describeRoute` stays in `route.ts`: review the Scalar prose together with the handler.
- Do not create `describe.ts` or `validators.ts` per operation.
- Inside `execute`, unwrap and map in named steps, never a nested expression:

```ts
execute: async () => {
  const result = await spaces.commands.archive({ spaceId });
  const archived = unwrapResult(result);
  return toSpaceDto(archived);
},
```

## Steps

1. Add request and response schemas to `operations/<operation>/contract.ts`; shared DTOs and schemas go in `contract/shared.ts`.
2. Add a mapper from the domain result to the DTO.
3. Register the route in `operations/<operation>/route.ts` with `describeRoute`, the `validate*` helpers, and `commandResponse` where they apply.
4. Re-export the operation contract from `contract/index.ts`.
5. Return the success or error envelope.
6. Add one example per documented response, typed from the response schema.
7. Add an integration test in `apps/api/test/integration/` that `safeParse`s the response.
8. Use the route from `apps/web` in the same PR.
9. Run `pnpm typecheck`, `pnpm docs:check`, `pnpm test:integration`.

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

- A second copy of a schema outside `contract/` or `operations/<operation>/contract.ts`.
- A hand-written example or mock object that does not come from the schema.
- A route that imports `drizzle-orm` or `postgres`; call commands and queries instead.
- Changing behavior without updating the Scalar description.
- Forgetting the web client in the same PR.
- Splitting `describeRoute` or the validators into per-operation files.
- A nested `unwrapResult(await ...)` composition inside `execute`.

## Definition of done

The endpoint is done only when `pnpm docs:check` passes, the integration test parses the response,
and the web client compiles.

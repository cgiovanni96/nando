# API contract

This document is the working checklist for the HTTP contract between `apps/web` and `apps/api`. The decision record is [ADR-0022](../adr/0022-contratto-http-web-api.md).

## Scope

Read this before changing:

- anything under `apps/api/src/http`;
- the typed API client in `apps/web`;
- the OpenAPI/Scalar surface;
- fixtures, stubs, or examples that describe API responses.

## Source of truth

Each route group keeps one contract module:

```text
apps/api/src/http/<module>/
  contract.ts      request and response Zod schemas, DTO types, examples, factories
  routes.ts        describeRoute + validator + handler
  mapper.ts        domain -> DTO
  routes.test.ts   integration test + safeParse of responses
```

`contract.ts` is the only place where wire shapes are declared. It exports:

- the request schema, used by both `validator` and `describeRoute`;
- the response schemas, used by `describeRoute`, examples, and tests;
- DTO types as `z.infer` of those schemas;
- example values and fixture factories.

`AppType` is assembled from the registered routes in `apps/api`. `apps/web` imports it type-only, through the types-only entrypoint. It must never import the runtime of `apps/api`.

## Adding a route

1. Add request and response schemas to `contract.ts`. Do not use domain entities as DTOs.
2. Add a mapper from the domain result to the DTO.
3. Register the route with `describeRoute` and the shared request schema through `validator`.
4. Return the success or error envelope.
5. Add at least one example per documented response, typed from the response schema.
6. Add an integration test that calls the route and `safeParse`s the response against the documented schema.
7. Regenerate or inspect the OpenAPI document through the docs route.
8. Run `pnpm typecheck`, `pnpm docs:check`, and `pnpm test:integration`.
9. Use the route from `apps/web` in the same PR; `pnpm typecheck` must pass.

## Endpoint definition of done

An endpoint is done only when all of these are true:

- it is registered with `describeRoute`;
- request and response schemas come from `contract.ts`, with no copies;
- every documented response has a schema and an example;
- an integration test proves the behavior and `safeParse`s the response;
- `pnpm typecheck` and `pnpm docs:check` pass;
- the `apps/web` client that uses it compiles;
- the Scalar description says what the command does and which errors it can return.

## Wire rules

- Queries use `GET` and have no side effects. Commands use `POST`.
- Every command body includes `commandId`, a client-generated UUIDv7, stable across retries.
- The client never sends `actorId`, `source`, `occurredAt`, `correlationId`, or `causationId`.
- The client never sends an entity `id` on create. The server generates entity IDs.
- Response shape is `{ ok: true, data }` or `{ ok: false, error: { code, message, details? }, requestId }`.
- Timestamps are ISO 8601 UTC strings. Date-only values are `YYYY-MM-DD`. Never use `Date` in a DTO.
- Nullable fields are present with `null`; do not use absence to mean "empty".
- Lists are always arrays and paginate with an opaque cursor.
- Error codes are stable English identifiers; messages are Italian and safe to display.
- Never send outbox or domain events to the browser. The SSE surface is a separate projection.

## Mock and fixture policy

- Do not create a separate mock layer, MSW handlers, or hand-written response objects.
- The stub is a real `apps/api` route that returns fixtures from `contract.ts`.
- The local web app runs against the stub API.
- Examples in Scalar and fixtures in tests come from the same factories. If a schema changes, the example must fail to compile or fail `safeParse`.
- A mock that does not derive from `contract.ts` is a bug.

## Contract tests

Every route group has an integration test that:

- sends a deterministic request;
- asserts the status code and the command result;
- parses the JSON body with the documented response schema (`safeParse`);
- covers at least the success case and the main domain error.

The test is not a replacement for domain tests. It proves that the wire shape and the implementation agree.

## OpenAPI and Scalar

- Routes are described with `hono-openapi`'s `describeRoute` and `validator`.
- The spec is generated with `openAPIRouteHandler`; Scalar is served with `@scalar/hono-api-reference`.
- The docs routes are `GET /api/openapi.json` and `GET /api/reference`.
- The spec uses full `/api/...` paths and `servers: [{ url: '/' }]`, so "Try it" stays same-origin and goes through the web proxy.
- Documentation routes are controlled by `DOCS_ENABLED`: on in local and staging, off in production by default.
- Do not commit a generated OpenAPI document. `docs:check` generates it in memory.
- `GET /api/health` is infrastructure: it is not part of the wire contract, it is not proxied by `web`, and it is not in OpenAPI. The browser never calls it.

## Commands

The contract assumes these commands. Until they exist, treat them as required checks in review.

```text
pnpm typecheck          TypeScript across workspaces
pnpm docs:check         route/spec alignment, examples, OpenAPI validation
pnpm test:integration   API integration tests, including response safeParse
pnpm verify             typecheck + lint + db:check + docs:check + test + test:integration + build
```

`docs:check` must fail when:

- a registered route is missing from the spec, or a spec path is not registered;
- a documented response has no schema or no example;
- the generated document is not valid OpenAPI 3.1.

## What remains manual

- `summary`, `description`, and `tags` are prose. No type checks that they describe the behavior correctly.
- Semantics: a schema does not know the difference between "complete" and "skip".
- Runtime coverage: contract tests cover the cases that are written, not every branch.

When behavior changes, update the Scalar description, the example, and the test in the same PR. That is a review requirement, not an automated check.

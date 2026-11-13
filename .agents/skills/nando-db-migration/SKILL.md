---
name: nando-db-migration
description: Use when changing a Drizzle schema, generating or applying a migration, or touching seeds and fixtures. Enforces the single-writer and forward-only rules.
---

# Nando database migration

Read `docs/agents/architecture.md`, ADR-0011 (persistence, history, backup) and ADR-0021 (tests)
before changing the schema. Migrations are forward-only.

## Rules

- Only `apps/api`, `apps/worker`, and `apps/api/src/migrate.ts` touch the database. `web` never does.
- The schema lives in the package that owns the table: `packages/core`, a capability, or
  `packages/platform`.
- `packages/platform` re-exports the schemas so the migration journal stays single.
- There is no down migration. A mistake is fixed with a new forward migration.
- Integration tests use the real Postgres and `TRUNCATE ... CASCADE` between tests.

## Steps

1. Edit the owning `schema.ts`. Do not create a second schema in `packages/platform`.
2. Run `pnpm db:generate`.
3. Read the generated SQL before applying it. Check for destructive changes, table rewrites, locks,
   and missing defaults.
4. Run `pnpm db:migrate`.
5. Run `pnpm db:check`; it must not report drift.
6. Update factories, seeds, and integration tests that depend on the new shape.
7. Run `pnpm test:integration` and `pnpm typecheck`.

## Review checklist

- Is the change compatible with the deploy window in which the old and new containers coexist?
- Does a `NOT NULL` column have a default or a backfill before it is enforced?
- Does a new index lock a large table? Use `CREATE INDEX CONCURRENTLY` outside a transaction when
  needed.
- Is a new column nullable or defaulted, so old code keeps working?
- Are `pgvector` columns and indexes created with the right operator class?
- Do seeds and the owner record still satisfy foreign keys?

## Commands

```text
pnpm db:generate    generate a migration from the schema
pnpm db:migrate     apply migrations
pnpm db:check       fail on drift between schema and migrations
pnpm db:seed        seed the owner and the initial Space
pnpm test:integration
```

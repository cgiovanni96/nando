import { sql } from "drizzle-orm";

import { createDatabase, type Database, type DatabaseHandle } from "./client";

export const TEST_OWNER_ID = process.env.TEST_OWNER_ID ?? "0199a4c2-7a10-7000-8000-000000000001";

export function requireTestDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;

  if (!url) {
    throw new Error(
      "TEST_DATABASE_URL non impostata. Esegui `pnpm test:integration` dalla radice del repository.",
    );
  }

  return url;
}

export function createTestDatabase(): DatabaseHandle {
  return createDatabase(requireTestDatabaseUrl());
}

export async function truncateAll(db: Database): Promise<void> {
  const rows = await db.execute<{ tablename: string }>(sql`
    select tablename
    from pg_tables
    where schemaname = 'public'
  `);

  const tables = Array.from(rows, (row) => `"public"."${row.tablename}"`);

  if (tables.length === 0) return;

  await db.execute(sql.raw(`truncate table ${tables.join(", ")} cascade`));
}

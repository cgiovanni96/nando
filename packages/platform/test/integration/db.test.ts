import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { ownerExists, seedOwner } from "../../src/db/owner";
import { createTestDatabase, TEST_OWNER_ID } from "../../src/db/testing";

describe("database", () => {
  it("has the application tables and the migration journal", async () => {
    const { db, close } = createTestDatabase();

    try {
      const publicTables = await db.execute<{ tablename: string }>(sql`
        select tablename
        from pg_tables
        where schemaname = 'public'
        order by tablename
      `);
      const names = Array.from(publicTables, (row) => row.tablename);

      expect(names).toContain("person");
      expect(names).toContain("user");

      const journal = await db.execute<{ count: string }>(sql`
        select count(*)::text as count
        from drizzle.__drizzle_migrations
      `);

      expect(Number(Array.from(journal)[0]?.count)).toBeGreaterThanOrEqual(1);
    } finally {
      await close();
    }
  });

  it("seeds the owner idempotently", async () => {
    const { db, close } = createTestDatabase();

    try {
      await seedOwner(db, TEST_OWNER_ID);
      await seedOwner(db, TEST_OWNER_ID);

      expect(await ownerExists(db, TEST_OWNER_ID)).toBe(true);
    } finally {
      await close();
    }
  });
});

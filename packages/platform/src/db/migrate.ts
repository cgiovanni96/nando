import { fileURLToPath } from "node:url";

import { migrate } from "drizzle-orm/postgres-js/migrator";

import { createDatabase } from "./client";

export const defaultMigrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));

export function resolveMigrationsFolder(): string {
  return process.env.MIGRATIONS_DIR ?? defaultMigrationsFolder;
}

export async function runMigrations(
  databaseUrl: string,
  migrationsFolder: string = resolveMigrationsFolder(),
): Promise<void> {
  const { db, close } = createDatabase(databaseUrl);

  try {
    await migrate(db, { migrationsFolder });
  } finally {
    await close();
  }
}

import { requireTestDatabaseUrl } from "../../src/db/testing";
import { resolveMigrationsFolder, runMigrations } from "../../src/db/migrate";

export default async function setup() {
  const databaseUrl = requireTestDatabaseUrl();
  await runMigrations(databaseUrl, resolveMigrationsFolder());
}

import { parseMigrateConfig } from "../config/config";
import { loadEnv } from "../config/env";
import { runMigrations } from "../db/migrate";

async function main() {
  loadEnv();
  const config = parseMigrateConfig();
  await runMigrations(config.DATABASE_URL);
  console.log("[nando] migrations applied");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

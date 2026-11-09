import {
  createDatabase,
  loadEnv,
  parseSeedConfig,
  runMigrations,
  seedOwner,
} from "@nando/platform";

async function main() {
  loadEnv();
  const config = parseSeedConfig();
  const migrationsFolder = process.env.MIGRATIONS_DIR;

  await runMigrations(config.DATABASE_URL, migrationsFolder);

  const { db, close } = createDatabase(config.DATABASE_URL);

  try {
    await seedOwner(db, config.OWNER_USER_ID);
  } finally {
    await close();
  }

  console.log("[nando] migrations applied and owner seeded");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

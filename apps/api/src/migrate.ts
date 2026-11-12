import {
  createDatabase,
  createLogger,
  loadEnv,
  parseSeedConfig,
  runMigrations,
  seedOwner,
} from "@nando/platform";

const bootstrapLogger = createLogger({
  level: "info",
  service: "migrate",
  pretty: process.env.NODE_ENV !== "production",
});

async function main() {
  loadEnv();
  const config = parseSeedConfig();
  const logger = createLogger({
    level: config.LOG_LEVEL,
    service: "migrate",
    pretty: config.NODE_ENV === "development",
  });
  const migrationsFolder = process.env.MIGRATIONS_DIR;

  await runMigrations(config.DATABASE_URL, migrationsFolder);

  const { db, close } = createDatabase(config.DATABASE_URL);

  try {
    await seedOwner(db, config.OWNER_USER_ID);
  } finally {
    await close();
  }

  logger.info({}, "migrations applied and owner seeded");
}

main().catch((error: unknown) => {
  bootstrapLogger.error({ err: error }, "migration failed");
  process.exit(1);
});

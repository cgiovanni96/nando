export {
  apiConfigSchema,
  ConfigError,
  migrateConfigSchema,
  parseApiConfig,
  parseMigrateConfig,
  parseSeedConfig,
  parseWebConfig,
  parseWorkerConfig,
  seedConfigSchema,
  webConfigSchema,
  workerConfigSchema,
  type ApiConfig,
  type MigrateConfig,
  type SeedConfig,
  type WebConfig,
  type WorkerConfig,
} from "./config/config";
export { loadEnv } from "./config/env";
export { createDatabase, type Database, type DatabaseHandle } from "./db/client";
export { defaultMigrationsFolder, resolveMigrationsFolder, runMigrations } from "./db/migrate";
export { assertOwner, ownerExists, seedOwner } from "./db/owner";
export {
  createTestDatabase,
  requireTestDatabaseUrl,
  TEST_OWNER_ID,
  truncateAll,
} from "./db/testing";
export { idempotency } from "./db/schema/idempotency";
export { user } from "./db/schema/user";
export {
  hashPayload,
  IdempotencyInProgressError,
  IdempotencyKeyReuseError,
  runIdempotentCommand,
  type IdempotentCommandInput,
} from "./idempotency/run";

// Il database e le migrazioni vivono qui; le capability non li importano direttamente.
export const PLATFORM_MODULE = "platform" as const;

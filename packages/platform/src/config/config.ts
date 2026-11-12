import { z } from "zod";

const nodeEnv = z.enum(["development", "test", "production"]).default("development");

const booleanFromEnv = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

const port = z.coerce.number().int().min(1).max(65535);

const logLevel = z
  .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
  .default("info");

export const apiConfigSchema = z
  .object({
    NODE_ENV: nodeEnv,
    DATABASE_URL: z.url(),
    OWNER_USER_ID: z.uuid(),
    INTERNAL_TOKEN: z.string().min(16),
    DOCS_ENABLED: booleanFromEnv,
    PORT: port.default(3000),
    LOG_LEVEL: logLevel,
  })
  .strict();

export const workerConfigSchema = z
  .object({
    NODE_ENV: nodeEnv,
    DATABASE_URL: z.url(),
    OWNER_USER_ID: z.uuid(),
    LOG_LEVEL: logLevel,
  })
  .strict();

export const migrateConfigSchema = z
  .object({
    NODE_ENV: nodeEnv,
    DATABASE_URL: z.url(),
  })
  .strict();

export const seedConfigSchema = z
  .object({
    NODE_ENV: nodeEnv,
    DATABASE_URL: z.url(),
    OWNER_USER_ID: z.uuid(),
    LOG_LEVEL: logLevel,
  })
  .strict();

export const webConfigSchema = z
  .object({
    NODE_ENV: nodeEnv,
    API_URL: z.url(),
    INTERNAL_TOKEN: z.string().min(16),
    PORT: port.default(3001),
  })
  .strict();

export type ApiConfig = z.infer<typeof apiConfigSchema>;
export type WorkerConfig = z.infer<typeof workerConfigSchema>;
export type MigrateConfig = z.infer<typeof migrateConfigSchema>;
export type SeedConfig = z.infer<typeof seedConfigSchema>;
export type WebConfig = z.infer<typeof webConfigSchema>;

export class ConfigError extends Error {
  override name = "ConfigError";
}

function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown, label: string): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ConfigError(`Configurazione ${label} non valida:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

export function parseApiConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  return parseOrThrow(
    apiConfigSchema,
    {
      NODE_ENV: env.NODE_ENV,
      DATABASE_URL: env.DATABASE_URL,
      OWNER_USER_ID: env.OWNER_USER_ID,
      INTERNAL_TOKEN: env.INTERNAL_TOKEN,
      DOCS_ENABLED: env.DOCS_ENABLED,
      PORT: env.PORT,
      LOG_LEVEL: env.LOG_LEVEL,
    },
    "api",
  );
}

export function parseWorkerConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  return parseOrThrow(
    workerConfigSchema,
    {
      NODE_ENV: env.NODE_ENV,
      DATABASE_URL: env.DATABASE_URL,
      OWNER_USER_ID: env.OWNER_USER_ID,
      LOG_LEVEL: env.LOG_LEVEL,
    },
    "worker",
  );
}

export function parseMigrateConfig(env: NodeJS.ProcessEnv = process.env): MigrateConfig {
  return parseOrThrow(
    migrateConfigSchema,
    {
      NODE_ENV: env.NODE_ENV,
      DATABASE_URL: env.DATABASE_URL,
    },
    "migrate",
  );
}

export function parseSeedConfig(env: NodeJS.ProcessEnv = process.env): SeedConfig {
  return parseOrThrow(
    seedConfigSchema,
    {
      NODE_ENV: env.NODE_ENV,
      DATABASE_URL: env.DATABASE_URL,
      OWNER_USER_ID: env.OWNER_USER_ID,
      LOG_LEVEL: env.LOG_LEVEL,
    },
    "seed",
  );
}

export function parseWebConfig(env: NodeJS.ProcessEnv = process.env): WebConfig {
  return parseOrThrow(
    webConfigSchema,
    {
      NODE_ENV: env.NODE_ENV,
      API_URL: env.API_URL,
      INTERNAL_TOKEN: env.INTERNAL_TOKEN,
      PORT: env.PORT,
    },
    "web",
  );
}

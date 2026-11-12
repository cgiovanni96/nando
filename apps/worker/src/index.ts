import {
  assertOwner,
  createDatabase,
  createLogger,
  loadEnv,
  parseWorkerConfig,
} from "@nando/platform";

export const WORKER_MODULE = "worker" as const;

const bootstrapLogger = createLogger({
  level: "info",
  service: "worker",
  pretty: process.env.NODE_ENV !== "production",
});

async function main() {
  loadEnv();
  const config = parseWorkerConfig();
  const logger = createLogger({
    level: config.LOG_LEVEL,
    service: "worker",
    pretty: config.NODE_ENV === "development",
  });
  const { db, close } = createDatabase(config.DATABASE_URL);

  try {
    await assertOwner(db, config.OWNER_USER_ID);
  } catch (error) {
    await close();
    throw error;
  }

  logger.info({}, "worker ready");

  const keepAlive = setInterval(() => {
    // Nessun job in M0: il processo resta vivo finché non arriva un segnale.
  }, 60_000);

  let stopping = false;

  async function shutdown(signal: string) {
    if (stopping) return;
    stopping = true;
    clearInterval(keepAlive);
    logger.info({ signal }, "worker received signal, stopping");
    await close();
    process.exit(0);
  }

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((error: unknown) => {
  bootstrapLogger.error({ err: error }, "worker failed to start");
  process.exit(1);
});

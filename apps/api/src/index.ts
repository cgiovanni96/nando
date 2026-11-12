import { serve } from "@hono/node-server";
import {
  assertOwner,
  createDatabase,
  createLogger,
  loadEnv,
  parseApiConfig,
} from "@nando/platform";

import { createApiApp } from "./http/app";

const bootstrapLogger = createLogger({
  level: "info",
  service: "api",
  pretty: process.env.NODE_ENV !== "production",
});

async function main() {
  loadEnv();
  const config = parseApiConfig();
  const logger = createLogger({
    level: config.LOG_LEVEL,
    service: "api",
    pretty: config.NODE_ENV === "development",
  });
  const { db, close } = createDatabase(config.DATABASE_URL);

  try {
    await assertOwner(db, config.OWNER_USER_ID);
  } catch (error) {
    await close();
    throw error;
  }

  const app = createApiApp({ config, db, logger });
  const server = serve({ fetch: app.fetch, port: config.PORT }, (info) => {
    logger.info({ port: info.port }, "api listening");
  });

  let stopping = false;

  async function shutdown(signal: string) {
    if (stopping) return;
    stopping = true;
    logger.info({ signal }, "api received signal, stopping");
    server.close();
    await close();
    process.exit(0);
  }

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((error: unknown) => {
  bootstrapLogger.error({ err: error }, "api failed to start");
  process.exit(1);
});

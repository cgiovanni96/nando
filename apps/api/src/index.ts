import { serve } from "@hono/node-server";
import { assertOwner, createDatabase, loadEnv, parseApiConfig } from "@nando/platform";

import { app } from "./app";

async function main() {
  loadEnv();
  const config = parseApiConfig();
  const { db, close } = createDatabase(config.DATABASE_URL);

  try {
    await assertOwner(db, config.OWNER_USER_ID);
  } catch (error) {
    await close();
    throw error;
  }

  const server = serve({ fetch: app.fetch, port: config.PORT }, (info) => {
    console.log(`[nando] api listening on http://127.0.0.1:${info.port}`);
  });

  let stopping = false;

  async function shutdown(signal: string) {
    if (stopping) return;
    stopping = true;
    console.log(`[nando] api received ${signal}, stopping`);
    server.close();
    await close();
    process.exit(0);
  }

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

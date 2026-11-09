import { assertOwner, createDatabase, loadEnv, parseWorkerConfig } from "@nando/platform";

export const WORKER_MODULE = "worker" as const;

async function main() {
  loadEnv();
  const config = parseWorkerConfig();
  const { db, close } = createDatabase(config.DATABASE_URL);

  try {
    await assertOwner(db, config.OWNER_USER_ID);
  } catch (error) {
    await close();
    throw error;
  }

  console.log("[nando] worker ready");

  const keepAlive = setInterval(() => {
    // Nessun job in M0: il processo resta vivo finché non arriva un segnale.
  }, 60_000);

  let stopping = false;

  async function shutdown(signal: string) {
    if (stopping) return;
    stopping = true;
    clearInterval(keepAlive);
    console.log(`[nando] worker received ${signal}, stopping`);
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

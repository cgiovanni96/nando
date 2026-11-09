import { parseSeedConfig } from "../config/config";
import { loadEnv } from "../config/env";
import { createDatabase } from "../db/client";
import { seedOwner } from "../db/owner";

async function main() {
  loadEnv();
  const config = parseSeedConfig();
  const { db, close } = createDatabase(config.DATABASE_URL);

  try {
    await seedOwner(db, config.OWNER_USER_ID);
    console.log(`[nando] owner ${config.OWNER_USER_ID} seeded`);
  } finally {
    await close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

import { createDatabase, loadEnv, parseSeedConfig, seedOwner } from "@nando/platform";

import { INITIAL_SPACE_NAME, seedInitialSpace } from "@api/seed";

async function main() {
  loadEnv();
  const config = parseSeedConfig();
  const { db, close } = createDatabase(config.DATABASE_URL);

  try {
    await seedOwner(db, config.OWNER_USER_ID);
    await seedInitialSpace(db);
    console.log(`[nando] owner ${config.OWNER_USER_ID} and Space "${INITIAL_SPACE_NAME}" seeded`);
  } finally {
    await close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

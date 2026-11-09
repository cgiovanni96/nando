import { afterAll, beforeEach } from "vitest";

import { createTestDatabase, truncateAll } from "../../src/db/testing";

const handle = createTestDatabase();

beforeEach(async () => {
  await truncateAll(handle.db);
});

afterAll(async () => {
  await handle.close();
});

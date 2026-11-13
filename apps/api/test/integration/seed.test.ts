import { space } from "@nando/core";
import { createTestDatabase } from "@nando/platform";
import { afterAll, describe, expect, it } from "vitest";

import { INITIAL_SPACE_ID, INITIAL_SPACE_NAME, seedInitialSpace } from "@api/seed";

const handle = createTestDatabase();

afterAll(async () => {
  await handle.close();
});

describe("initial Space seed", () => {
  it("inserts the demo Space once and keeps it stable", async () => {
    await seedInitialSpace(handle.db);
    await seedInitialSpace(handle.db);

    const rows = await handle.db.select().from(space);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: INITIAL_SPACE_ID,
      name: INITIAL_SPACE_NAME,
      kind: "area",
      parentId: null,
      archivedAt: null,
      deletedAt: null,
    });
  });
});

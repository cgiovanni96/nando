import { createSpaceModule } from "@nando/core";
import { fixedClock, newId } from "@nando/kernel";
import { createTestDatabase, runIdempotentCommand, TEST_OWNER_ID } from "@nando/platform";
import { afterAll, describe, expect, it } from "vitest";

const handle = createTestDatabase();
const spaces = createSpaceModule({
  db: handle.db,
  clock: fixedClock("2026-11-12T09:00:00.000Z"),
  ids: newId,
});

afterAll(async () => {
  await handle.close();
});

describe("runIdempotentCommand", () => {
  it("rolls back command writes and the idempotency row together", async () => {
    const commandId = newId();

    await expect(
      runIdempotentCommand({
        db: handle.db,
        actorId: TEST_OWNER_ID,
        commandName: "test.atomic.rollback",
        commandId,
        payload: { name: "Atomica" },
        execute: async (tx) => {
          const created = await spaces.commands.create(
            { name: "Atomica", kind: "area", parentId: null },
            tx,
          );

          if (!created.ok) throw new Error(created.error.message);
          throw new Error("boom");
        },
      }),
    ).rejects.toThrow("boom");

    const list = await spaces.queries.list({});
    expect(list.items).toHaveLength(0);
  });

  it("commits the command and the idempotency row together, replay included", async () => {
    const commandId = newId();
    const run = () =>
      runIdempotentCommand({
        db: handle.db,
        actorId: TEST_OWNER_ID,
        commandName: "test.atomic.commit",
        commandId,
        payload: { name: "Atomica" },
        execute: async (tx) => {
          const created = await spaces.commands.create(
            { name: "Atomica", kind: "area", parentId: null },
            tx,
          );

          if (!created.ok) throw new Error(created.error.message);
          return created.value;
        },
      });

    const first = await run();
    const replay = await run();

    expect(replay.id).toBe(first.id);

    const list = await spaces.queries.list({});
    expect(list.items).toHaveLength(1);
  });
});

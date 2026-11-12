import { eq } from "drizzle-orm";
import { task } from "@nando/core";
import { afterAll, describe, expect, it } from "vitest";

import { inboxResponseSchema } from "@api/http/inbox/contract";
import { createSpace, createTask, deleteTask, get, handle } from "./helpers";

afterAll(async () => {
  await handle.close();
});

async function setUpdatedAt(taskId: string, updatedAt: string): Promise<void> {
  await handle.db
    .update(task)
    .set({ updatedAt: new Date(updatedAt) })
    .where(eq(task.id, taskId));
}

describe("inbox tasks", () => {
  it("lists only tasks without a Space that are not deleted", async () => {
    const space = await createSpace("Lavoro");
    const inInbox = await createTask({ title: "Fare la spesa" });
    await createTask({ title: "Scrivere l'ADR", spaceId: space.id });
    const deleted = await createTask({ title: "Task cancellato" });
    await deleteTask(deleted.id);

    const response = await get("/api/inbox");
    const parsed = inboxResponseSchema.safeParse(await response.json());

    expect(response.status).toBe(200);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.data.items).toEqual([
        expect.objectContaining({
          entityType: "task",
          id: inInbox.id,
          title: "Fare la spesa",
        }),
      ]);
      expect(parsed.data.data.nextCursor).toBeNull();
    }
  });

  it("orders by update time and resumes after the composed cursor", async () => {
    const oldest = await createTask({ title: "Primo" });
    const middle = await createTask({ title: "Secondo" });
    const newest = await createTask({ title: "Terzo" });
    await setUpdatedAt(oldest.id, "2026-11-11T10:00:00.000Z");
    await setUpdatedAt(middle.id, "2026-11-11T11:00:00.000Z");
    await setUpdatedAt(newest.id, "2026-11-11T12:00:00.000Z");

    const firstPage = await get("/api/inbox?limit=2");
    const first = inboxResponseSchema.safeParse(await firstPage.json());

    expect(first.success).toBe(true);
    if (!first.success) return;
    expect(first.data.data.items.map((item) => item.id)).toEqual([newest.id, middle.id]);
    expect(first.data.data.nextCursor).not.toBeNull();

    const secondPage = await get(
      `/api/inbox?limit=2&cursor=${encodeURIComponent(first.data.data.nextCursor ?? "")}`,
    );
    const second = inboxResponseSchema.safeParse(await secondPage.json());

    expect(second.success).toBe(true);
    if (second.success) {
      expect(second.data.data.items.map((item) => item.id)).toEqual([oldest.id]);
      expect(second.data.data.nextCursor).toBeNull();
    }
  });
});

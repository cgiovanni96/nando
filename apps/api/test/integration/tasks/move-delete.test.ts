import { eq } from "drizzle-orm";
import { task } from "@nando/core";
import { newId } from "@nando/kernel";
import { afterAll, describe, expect, it } from "vitest";

import { errorEnvelopeSchema } from "@api/http/envelope";
import { inboxResponseSchema } from "@api/http/inbox/contract";
import {
  moveTaskRequestFactory,
  taskCommandRequestFactory,
  taskListResponseSchema,
} from "@api/http/tasks/contract";
import {
  archiveSpace,
  createSpace,
  createTask,
  deleteTask,
  get,
  handle,
  moveTask,
  post,
  readTask,
  restoreTask,
} from "./helpers";

afterAll(async () => {
  await handle.close();
});

const DAY = 24 * 60 * 60 * 1000;

async function taskIds(path: string): Promise<string[]> {
  const response = await get(path);
  const parsed = taskListResponseSchema.safeParse(await response.json());

  expect(response.status).toBe(200);
  expect(parsed.success).toBe(true);

  if (!parsed.success) throw new Error(JSON.stringify(parsed.error));
  return parsed.data.data.items.map((item) => item.id);
}

async function inboxIds(): Promise<string[]> {
  const response = await get("/api/inbox");
  const parsed = inboxResponseSchema.safeParse(await response.json());

  expect(response.status).toBe(200);
  expect(parsed.success).toBe(true);

  if (!parsed.success) throw new Error(JSON.stringify(parsed.error));
  return parsed.data.data.items.map((item) => item.id);
}

describe("task move", () => {
  it("moves a task into a Space and back to Inbox", async () => {
    const space = await createSpace("Lavoro");
    const created = await createTask({ title: "Scrivere l'ADR" });

    const moved = await moveTask(created.id, space.id);

    expect(moved).toMatchObject({ id: created.id, spaceId: space.id, version: 2 });
    expect(await taskIds("/api/tasks?spaceId=" + space.id)).toEqual([created.id]);
    expect(await inboxIds()).toEqual([]);

    const reverted = await moveTask(created.id, null);

    expect(reverted).toMatchObject({ spaceId: null, version: 3 });
    expect(await taskIds("/api/tasks?spaceId=" + space.id)).toEqual([]);
    expect(await inboxIds()).toEqual([created.id]);
  });

  it("keeps exactly one owner when a task moves between Spaces", async () => {
    const origin = await createSpace("Casa");
    const destination = await createSpace("Lavoro");
    const created = await createTask({ title: "Spostare la poltrona", spaceId: origin.id });

    const moved = await moveTask(created.id, destination.id);

    expect(moved.spaceId).toBe(destination.id);
    expect(await taskIds(`/api/tasks?spaceId=${origin.id}`)).toEqual([]);
    expect(await taskIds(`/api/tasks?spaceId=${destination.id}`)).toEqual([created.id]);
    expect(await inboxIds()).toEqual([]);
  });

  it("treats a move to the current Space as an idempotent no-op", async () => {
    const space = await createSpace("Salute");
    const created = await createTask({ title: "Prenotare la visita", spaceId: space.id });

    const moved = await moveTask(created.id, space.id);

    expect(moved).toMatchObject({ spaceId: space.id, version: created.version });
  });

  it("refuses to move a task into an archived Space", async () => {
    const space = await createSpace("Formazione");
    const created = await createTask({ title: "Tedesco B1" });
    await archiveSpace(space.id);

    const response = await post(
      `/api/tasks/${created.id}/move`,
      moveTaskRequestFactory({ commandId: newId(), spaceId: space.id }),
    );
    const parsed = errorEnvelopeSchema.safeParse(await response.json());

    expect(response.status).toBe(422);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.error.code).toBe("domain_rule_violation");
    }
    expect(await readTask(created.id)).toMatchObject({ spaceId: null });
  });

  it("returns 404 when the task or the Space does not exist", async () => {
    const created = await createTask({ title: "Task senza Space" });

    const unknownSpace = await post(
      `/api/tasks/${created.id}/move`,
      moveTaskRequestFactory({ commandId: newId(), spaceId: newId() }),
    );
    const unknownTask = await post(
      `/api/tasks/${newId()}/move`,
      moveTaskRequestFactory({ commandId: newId(), spaceId: null }),
    );

    expect(unknownSpace.status).toBe(404);
    expect(unknownTask.status).toBe(404);
  });
});

describe("task deletion with grace", () => {
  it("hides the task from lists but keeps it readable by id", async () => {
    const created = await createTask({ title: "Comprare il pane" });

    const deleted = await deleteTask(created.id);

    expect(deleted.deletedAt).not.toBeNull();
    expect(deleted.restorableUntil).not.toBeNull();
    if (deleted.deletedAt && deleted.restorableUntil) {
      expect(
        new Date(deleted.restorableUntil).getTime() - new Date(deleted.deletedAt).getTime(),
      ).toBe(7 * DAY);
    }

    expect(await taskIds("/api/tasks")).toEqual([]);
    expect(await inboxIds()).toEqual([]);
    expect(await taskIds("/api/tasks?state=deleted")).toEqual([created.id]);

    const read = await readTask(created.id);
    expect(read.deletedAt).toBe(deleted.deletedAt);
  });

  it("restores a task inside the window and returns it to Inbox", async () => {
    const created = await createTask({ title: "Restituire il libro" });
    const deleted = await deleteTask(created.id);

    const restored = await restoreTask(created.id);

    expect(restored).toMatchObject({
      deletedAt: null,
      restorableUntil: null,
      spaceId: null,
      version: deleted.version + 1,
    });
    expect(await taskIds("/api/tasks")).toEqual([created.id]);
    expect(await inboxIds()).toEqual([created.id]);
    expect(await taskIds("/api/tasks?state=deleted")).toEqual([]);
  });

  it("treats delete and restore on an already-stable task as no-ops", async () => {
    const created = await createTask({ title: "Chiamare Studio X" });

    const deleted = await deleteTask(created.id);
    const deletedAgain = await deleteTask(created.id);
    const restored = await restoreTask(created.id);
    const restoredAgain = await restoreTask(created.id);

    expect(deletedAgain).toMatchObject({ deletedAt: deleted.deletedAt, version: deleted.version });
    expect(restored.version).toBe(deleted.version + 1);
    expect(restoredAgain.version).toBe(restored.version);
  });

  it("refuses a restore after the grace window", async () => {
    const created = await createTask({ title: "Task scaduto" });
    await deleteTask(created.id);

    await handle.db
      .update(task)
      .set({ deletedAt: new Date(Date.now() - 8 * DAY) })
      .where(eq(task.id, created.id));

    const response = await post(
      `/api/tasks/${created.id}/restore`,
      taskCommandRequestFactory({ commandId: newId() }),
    );
    const parsed = errorEnvelopeSchema.safeParse(await response.json());

    expect(response.status).toBe(422);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.error.code).toBe("domain_rule_violation");
    }
    expect(await taskIds("/api/tasks?state=deleted")).toEqual([created.id]);
  });

  it("refuses a restore into an archived Space", async () => {
    const space = await createSpace("Archivio");
    const created = await createTask({ title: "Task archiviato", spaceId: space.id });
    await deleteTask(created.id);
    await archiveSpace(space.id);

    const response = await post(
      `/api/tasks/${created.id}/restore`,
      taskCommandRequestFactory({ commandId: newId() }),
    );

    expect(response.status).toBe(422);
    expect(await taskIds("/api/tasks?state=deleted")).toEqual([created.id]);
  });

  it("returns 404 for an unknown task", async () => {
    const missing = newId();

    const deleted = await post(
      `/api/tasks/${missing}/delete`,
      taskCommandRequestFactory({ commandId: newId() }),
    );
    const restored = await post(
      `/api/tasks/${missing}/restore`,
      taskCommandRequestFactory({ commandId: newId() }),
    );

    expect(deleted.status).toBe(404);
    expect(restored.status).toBe(404);
  });
});

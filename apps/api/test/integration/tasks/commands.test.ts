import { newId } from "@nando/kernel";
import { afterAll, describe, expect, it } from "vitest";

import { errorEnvelopeSchema } from "@api/http/envelope";
import {
  createTaskRequestFactory,
  taskListResponseSchema,
  taskResponseSchema,
  updateTaskRequestFactory,
} from "@api/http/tasks/contract";
import { app, archiveSpace, createSpace, createTask, get, handle, post, readTask } from "./helpers";

afterAll(async () => {
  await handle.close();
});

describe("task commands", () => {
  it("creates a task in Inbox with open status", async () => {
    const task = await createTask({ title: "Comprare il pane" });

    expect(task).toMatchObject({
      title: "Comprare il pane",
      status: "open",
      dueAt: null,
      spaceId: null,
      version: 1,
    });
  });

  it("captures a task without a Space", async () => {
    const response = await post(
      "/api/tasks",
      createTaskRequestFactory({
        commandId: newId(),
        title: "Cattura dalla dashboard",
        spaceId: null,
        dueAt: null,
      }),
    );
    const parsed = taskResponseSchema.safeParse(await response.json());

    expect(response.status).toBe(200);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.data).toMatchObject({
        title: "Cattura dalla dashboard",
        status: "open",
        spaceId: null,
        dueAt: null,
      });
    }

    const list = await get("/api/tasks");
    const listParsed = taskListResponseSchema.safeParse(await list.json());

    expect(listParsed.success).toBe(true);
    if (listParsed.success) {
      expect(listParsed.data.data.items).toHaveLength(1);
    }
  });

  it("creates a task in a Space with a due date", async () => {
    const space = await createSpace();
    const dueAt = "2026-11-12T18:00:00.000Z";
    const task = await createTask({
      title: "Prenotare la visita",
      spaceId: space.id,
      dueAt,
    });

    expect(task.spaceId).toBe(space.id);
    expect(task.dueAt).toBe(dueAt);
  });

  it("rejects a missing or archived Space", async () => {
    const missing = await post(
      "/api/tasks",
      createTaskRequestFactory({
        commandId: newId(),
        title: "Senza Space",
        spaceId: "0199a4c2-7a10-7000-8000-000000000999",
        dueAt: null,
      }),
    );
    const missingParsed = errorEnvelopeSchema.safeParse(await missing.json());

    expect(missing.status).toBe(404);
    expect(missingParsed.success).toBe(true);
    if (missingParsed.success) {
      expect(missingParsed.data.error.code).toBe("not_found");
    }

    const space = await createSpace();
    await archiveSpace(space.id);

    const archived = await post(
      "/api/tasks",
      createTaskRequestFactory({
        commandId: newId(),
        title: "In uno Space archiviato",
        spaceId: space.id,
        dueAt: null,
      }),
    );
    const archivedParsed = errorEnvelopeSchema.safeParse(await archived.json());

    expect(archived.status).toBe(422);
    expect(archivedParsed.success).toBe(true);
    if (archivedParsed.success) {
      expect(archivedParsed.data.error.code).toBe("domain_rule_violation");
    }
  });

  it("updates with expectedVersion and increments version", async () => {
    const task = await createTask({ title: "Titolo vecchio" });
    const dueAt = "2026-11-13T09:00:00.000Z";
    const response = await post(
      `/api/tasks/${task.id}/update`,
      updateTaskRequestFactory({
        commandId: newId(),
        expectedVersion: task.version,
        title: "Titolo nuovo",
        spaceId: null,
        dueAt,
      }),
    );
    const parsed = taskResponseSchema.safeParse(await response.json());

    expect(response.status).toBe(200);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.data.title).toBe("Titolo nuovo");
      expect(parsed.data.data.dueAt).toBe(dueAt);
      expect(parsed.data.data.version).toBe(2);
    }
  });

  it("rejects a stale version without overwriting", async () => {
    const task = await createTask({ title: "Originale" });

    await post(
      `/api/tasks/${task.id}/update`,
      updateTaskRequestFactory({
        commandId: newId(),
        expectedVersion: 1,
        title: "Prima modifica",
        spaceId: null,
        dueAt: null,
      }),
    );

    const stale = await post(
      `/api/tasks/${task.id}/update`,
      updateTaskRequestFactory({
        commandId: newId(),
        expectedVersion: 1,
        title: "Seconda modifica",
        spaceId: null,
        dueAt: null,
      }),
    );
    const staleParsed = errorEnvelopeSchema.safeParse(await stale.json());

    expect(stale.status).toBe(409);
    expect(staleParsed.success).toBe(true);
    if (staleParsed.success) {
      expect(staleParsed.data.error.code).toBe("version_conflict");
      expect(staleParsed.data.error.details).toEqual({ currentVersion: 2 });
    }

    expect((await readTask(task.id)).title).toBe("Prima modifica");
  });

  it("replays a create command and rejects a reused commandId", async () => {
    const commandId = newId();
    const payload = createTaskRequestFactory({
      commandId,
      title: "Replay",
      spaceId: null,
      dueAt: null,
    });

    const first = await post("/api/tasks", payload);
    const firstParsed = taskResponseSchema.safeParse(await first.json());
    const replay = await post("/api/tasks", payload);
    const replayParsed = taskResponseSchema.safeParse(await replay.json());

    expect(first.status).toBe(200);
    expect(replay.status).toBe(200);
    expect(firstParsed.success).toBe(true);
    expect(replayParsed.success).toBe(true);
    if (firstParsed.success && replayParsed.success) {
      expect(replayParsed.data.data.id).toBe(firstParsed.data.data.id);
    }

    const list = await get("/api/tasks");
    const listParsed = taskListResponseSchema.safeParse(await list.json());
    expect(listParsed.success).toBe(true);
    if (listParsed.success) {
      expect(listParsed.data.data.items).toHaveLength(1);
    }

    const conflict = await post(
      "/api/tasks",
      createTaskRequestFactory({
        commandId,
        title: "Payload diverso",
        spaceId: null,
        dueAt: null,
      }),
    );
    const conflictParsed = errorEnvelopeSchema.safeParse(await conflict.json());

    expect(conflict.status).toBe(409);
    expect(conflictParsed.success).toBe(true);
    if (conflictParsed.success) {
      expect(conflictParsed.data.error.code).toBe("idempotency_key_reuse");
    }
  });

  it("rejects an invalid title and a missing bearer", async () => {
    const invalid = await post("/api/tasks", {
      commandId: newId(),
      title: "   ",
      spaceId: null,
      dueAt: null,
    });
    const invalidParsed = errorEnvelopeSchema.safeParse(await invalid.json());

    expect(invalid.status).toBe(400);
    expect(invalidParsed.success).toBe(true);
    if (invalidParsed.success) {
      expect(invalidParsed.data.error.code).toBe("validation_error");
    }

    const unauthorized = await app.request("/api/tasks");
    const unauthorizedParsed = errorEnvelopeSchema.safeParse(await unauthorized.json());

    expect(unauthorized.status).toBe(401);
    expect(unauthorizedParsed.success).toBe(true);
    if (unauthorizedParsed.success) {
      expect(unauthorizedParsed.data.error.code).toBe("unauthorized");
    }
  });
});

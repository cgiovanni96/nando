import { newId } from "@nando/kernel";
import { afterAll, describe, expect, it } from "vitest";

import { errorEnvelopeSchema } from "../../../src/http/envelope";
import {
  taskCommandRequestFactory,
  taskListResponseSchema,
  taskResponseSchema,
} from "../../../src/http/tasks/contract";
import { createSpace, createTask, get, handle, post, readTask } from "./helpers";

afterAll(async () => {
  await handle.close();
});

describe("task queries", () => {
  it("reads a task with its flattened occurrence fields", async () => {
    const space = await createSpace();
    const dueAt = "2026-11-14T09:00:00.000Z";
    const created = await createTask({ title: "Leggere", spaceId: space.id, dueAt });

    const task = await readTask(created.id);

    expect(task).toMatchObject({
      id: created.id,
      title: "Leggere",
      status: "open",
      dueAt,
      spaceId: space.id,
      version: 1,
    });
  });

  it("filters by Space and by status", async () => {
    const firstSpace = await createSpace("Vita");
    const secondSpace = await createSpace("Lavoro");
    const inFirst = await createTask({ title: "Primo", spaceId: firstSpace.id });
    await createTask({ title: "Secondo", spaceId: secondSpace.id });
    await createTask({ title: "Inbox" });

    const bySpace = await get(`/api/tasks?spaceId=${firstSpace.id}`);
    const bySpaceParsed = taskListResponseSchema.safeParse(await bySpace.json());

    expect(bySpaceParsed.success).toBe(true);
    if (bySpaceParsed.success) {
      expect(bySpaceParsed.data.data.items.map((item) => item.id)).toEqual([inFirst.id]);
    }

    const completed = await post(
      `/api/tasks/${inFirst.id}/complete`,
      taskCommandRequestFactory({ commandId: newId() }),
    );
    expect(completed.status).toBe(200);

    const byStatus = await get("/api/tasks?status=completed");
    const byStatusParsed = taskListResponseSchema.safeParse(await byStatus.json());

    expect(byStatusParsed.success).toBe(true);
    if (byStatusParsed.success) {
      expect(byStatusParsed.data.data.items.map((item) => item.id)).toEqual([inFirst.id]);
    }
  });

  it("paginates tasks with an opaque cursor", async () => {
    await createTask({ title: "Uno" });
    await createTask({ title: "Due" });
    await createTask({ title: "Tre" });

    const first = await get("/api/tasks?limit=2");
    const firstParsed = taskListResponseSchema.safeParse(await first.json());

    expect(firstParsed.success).toBe(true);
    if (!firstParsed.success) return;

    expect(firstParsed.data.data.items).toHaveLength(2);
    expect(firstParsed.data.data.nextCursor).toEqual(expect.any(String));

    const cursor = firstParsed.data.data.nextCursor;
    if (!cursor) return;

    const second = await get(`/api/tasks?limit=2&cursor=${encodeURIComponent(cursor)}`);
    const secondParsed = taskListResponseSchema.safeParse(await second.json());

    expect(secondParsed.success).toBe(true);
    if (secondParsed.success) {
      expect(secondParsed.data.data.items).toHaveLength(1);
      expect(secondParsed.data.data.nextCursor).toBeNull();

      const firstIds = firstParsed.data.data.items.map((item) => item.id);
      const secondIds = secondParsed.data.data.items.map((item) => item.id);
      expect(secondIds.some((id) => firstIds.includes(id))).toBe(false);
    }
  });

  it("returns not_found for an unknown task", async () => {
    const response = await get("/api/tasks/0199a4c2-7a10-7000-8000-000000000999");
    const parsed = errorEnvelopeSchema.safeParse(await response.json());

    expect(response.status).toBe(404);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.error.code).toBe("not_found");
    }
  });

  it("rejects an invalid list query and an invalid task id", async () => {
    const invalidQuery = await get("/api/tasks?limit=0");
    const invalidQueryParsed = errorEnvelopeSchema.safeParse(await invalidQuery.json());

    expect(invalidQuery.status).toBe(400);
    expect(invalidQueryParsed.success).toBe(true);

    const invalidParam = await get("/api/tasks/not-a-uuid");
    const invalidParamParsed = errorEnvelopeSchema.safeParse(await invalidParam.json());

    expect(invalidParam.status).toBe(400);
    expect(invalidParamParsed.success).toBe(true);
  });

  it("keeps the response schema aligned with a created task", async () => {
    const task = await createTask({ title: "Schema" });
    const response = await get(`/api/tasks/${task.id}`);
    const parsed = taskResponseSchema.safeParse(await response.json());

    expect(parsed.success).toBe(true);
  });
});

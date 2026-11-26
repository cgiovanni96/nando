import { newId } from "@nando/kernel";
import { afterAll, describe, expect, it } from "vitest";

import { agendaResponseSchema } from "@api/http/agenda/contract";
import { errorEnvelopeSchema } from "@api/http/envelope";
import {
  taskCommandRequestFactory,
  taskListResponseSchema,
  taskResponseSchema,
  updateTaskRequestFactory,
} from "@api/http/tasks/contract";
import { createSpace, createTask, get, handle, post, readTask } from "./helpers";

afterAll(async () => {
  await handle.close();
});

describe("task queries", () => {
  it("reads a task with its flattened occurrence fields", async () => {
    const space = await createSpace();
    const to = "2026-11-14T09:00:00.000Z";
    const created = await createTask({
      title: "Leggere",
      spaceId: space.id,
      schedule: { allDay: false, from: null, to },
    });

    const task = await readTask(created.id);

    expect(task).toMatchObject({
      id: created.id,
      title: "Leggere",
      status: "open",
      schedule: { allDay: false, from: null, to, timeZone: "Europe/Rome" },
      timeZone: "Europe/Rome",
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

  it("filters tasks by the presence of a Schedule", async () => {
    const space = await createSpace("Vita");
    const inbox = await createTask({ title: "Inbox senza data" });
    const inSpace = await createTask({ title: "Space senza data", spaceId: space.id });
    const allDay = await createTask({
      title: "Conferenza",
      schedule: { allDay: true, from: "2026-12-01", to: "2026-12-02" },
    });
    const timed = await createTask({
      title: "Visita",
      schedule: { allDay: false, from: null, to: "2026-12-01T10:00:00.000Z" },
    });

    const unscheduled = await get("/api/tasks?scheduled=false");
    const unscheduledParsed = taskListResponseSchema.safeParse(await unscheduled.json());

    expect(unscheduled.status).toBe(200);
    expect(unscheduledParsed.success).toBe(true);
    if (unscheduledParsed.success) {
      const ids = unscheduledParsed.data.data.items.map((item) => item.id);
      expect(ids.sort()).toEqual([inbox.id, inSpace.id].sort());
      expect(unscheduledParsed.data.data.items.every((item) => item.schedule === null)).toBe(true);
    }

    const scheduled = await get("/api/tasks?scheduled=true");
    const scheduledParsed = taskListResponseSchema.safeParse(await scheduled.json());

    expect(scheduled.status).toBe(200);
    expect(scheduledParsed.success).toBe(true);
    if (scheduledParsed.success) {
      const ids = scheduledParsed.data.data.items.map((item) => item.id);
      expect(ids.sort()).toEqual([allDay.id, timed.id].sort());
    }
  });

  it("combines scheduled with status", async () => {
    const open = await createTask({ title: "Aperta" });
    const started = await createTask({ title: "Iniziata" });
    const startedResponse = await post(
      `/api/tasks/${started.id}/start`,
      taskCommandRequestFactory({ commandId: newId() }),
    );

    expect(startedResponse.status).toBe(200);

    const openList = await get("/api/tasks?scheduled=false&status=open");
    const openParsed = taskListResponseSchema.safeParse(await openList.json());

    expect(openParsed.success).toBe(true);
    if (openParsed.success) {
      expect(openParsed.data.data.items.map((item) => item.id)).toEqual([open.id]);
    }

    const startedList = await get("/api/tasks?scheduled=false&status=in_progress");
    const startedParsed = taskListResponseSchema.safeParse(await startedList.json());

    expect(startedParsed.success).toBe(true);
    if (startedParsed.success) {
      expect(startedParsed.data.data.items.map((item) => item.id)).toEqual([started.id]);
    }
  });

  it("paginates unscheduled tasks around a scheduled one", async () => {
    const first = await createTask({ title: "Uno" });
    await createTask({
      title: "Pianificata",
      schedule: { allDay: true, from: "2026-12-01", to: "2026-12-01" },
    });
    const second = await createTask({ title: "Due" });
    const third = await createTask({ title: "Tre" });

    const page = await get("/api/tasks?scheduled=false&limit=2");
    const pageParsed = taskListResponseSchema.safeParse(await page.json());

    expect(pageParsed.success).toBe(true);
    if (!pageParsed.success) return;

    expect(pageParsed.data.data.items.map((item) => item.id)).toEqual([third.id, second.id]);
    expect(pageParsed.data.data.nextCursor).toEqual(expect.any(String));

    const cursor = pageParsed.data.data.nextCursor;
    if (!cursor) return;

    const next = await get(
      `/api/tasks?scheduled=false&limit=2&cursor=${encodeURIComponent(cursor)}`,
    );
    const nextParsed = taskListResponseSchema.safeParse(await next.json());

    expect(nextParsed.success).toBe(true);
    if (nextParsed.success) {
      expect(nextParsed.data.data.items.map((item) => item.id)).toEqual([first.id]);
      expect(nextParsed.data.data.nextCursor).toBeNull();
    }
  });

  it("rejects an invalid scheduled filter", async () => {
    const response = await get("/api/tasks?scheduled=maybe");
    const parsed = errorEnvelopeSchema.safeParse(await response.json());

    expect(response.status).toBe(400);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.error.code).toBe("validation_error");
    }
  });

  it("moves a planned task out of scheduled=false and into the agenda", async () => {
    const task = await createTask({ title: "Da pianificare" });

    const update = await post(
      `/api/tasks/${task.id}/update`,
      updateTaskRequestFactory({
        commandId: newId(),
        expectedVersion: task.version,
        title: task.title,
        spaceId: null,
        schedule: { allDay: true, from: null, to: "2026-12-05" },
      }),
    );
    const updateParsed = taskResponseSchema.safeParse(await update.json());

    expect(update.status).toBe(200);
    expect(updateParsed.success).toBe(true);

    const unscheduled = await get("/api/tasks?scheduled=false");
    const unscheduledParsed = taskListResponseSchema.safeParse(await unscheduled.json());

    expect(unscheduledParsed.success).toBe(true);
    if (unscheduledParsed.success) {
      expect(unscheduledParsed.data.data.items.map((item) => item.id)).not.toContain(task.id);
    }

    const agenda = await get("/api/agenda?from=2026-12-05&to=2026-12-05");
    const agendaParsed = agendaResponseSchema.safeParse(await agenda.json());

    expect(agenda.status).toBe(200);
    expect(agendaParsed.success).toBe(true);
    if (agendaParsed.success) {
      const item = agendaParsed.data.data.items.find((entry) => entry.id === task.id);
      expect(item).toMatchObject({ id: task.id, dueDate: "2026-12-05" });
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

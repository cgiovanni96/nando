import { newId } from "@nando/kernel";
import { sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { errorEnvelopeSchema } from "@api/http/envelope";
import {
  reopenTaskRequestFactory,
  taskCommandRequestFactory,
  taskHistoryResponseSchema,
  taskResponseSchema,
} from "@api/http/tasks/contract";
import { createTask, get, handle, post } from "./helpers";

afterAll(async () => {
  await handle.close();
});

type Action = "start" | "todo" | "complete" | "skip" | "cancel";

async function run(taskId: string, action: Action, commandId = newId()) {
  const response = await post(
    `/api/tasks/${taskId}/${action}`,
    taskCommandRequestFactory({ commandId }),
  );
  const parsed = taskResponseSchema.safeParse(await response.json());
  expect(parsed.success).toBe(true);
  return { status: response.status, task: parsed.success ? parsed.data.data : null };
}

async function reopen(taskId: string, to?: "open" | "in_progress") {
  const response = await post(
    `/api/tasks/${taskId}/reopen`,
    reopenTaskRequestFactory({ commandId: newId(), ...(to ? { to } : {}) }),
  );
  const body: unknown = await response.json();
  return { status: response.status, body };
}

async function history(taskId: string) {
  const response = await get(`/api/tasks/${taskId}/history`);
  const parsed = taskHistoryResponseSchema.safeParse(await response.json());
  expect(response.status).toBe(200);
  expect(parsed.success).toBe(true);
  return parsed.success ? parsed.data.data.items.map((item) => item.kind) : [];
}

async function completionRows(taskId: string) {
  const result = await handle.db.execute<{ activity_id: string; rectified: boolean }>(sql`
    select c.activity_id, r.id is not null as rectified
    from task_completion c
    join task_occurrence o on o.id = c.occurrence_id
    left join task_rectification r on r.completion_id = c.id
    where o.task_id = ${taskId}
    order by c.occurred_at
  `);
  return [...result];
}

describe("completion, rectification and history", () => {
  it("complete, undo and complete again leaves three entries and reuses the activityId", async () => {
    const task = await createTask({ title: "Comprare i fiori" });

    expect((await run(task.id, "complete")).task?.status).toBe("completed");
    const reopened = await reopen(task.id);
    expect(reopened.status).toBe(200);
    expect((await run(task.id, "complete")).task?.status).toBe("completed");

    expect(await history(task.id)).toEqual(["completed", "reopened", "completed"]);

    const rows = await completionRows(task.id);
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.rectified)).toEqual([true, false]);
    expect(rows[0]?.activity_id).toBe(rows[1]?.activity_id);
  });

  it("replaying the same complete command does not create a second Completion", async () => {
    const task = await createTask({ title: "Una volta sola" });
    const commandId = newId();

    await run(task.id, "complete", commandId);
    await run(task.id, "complete", commandId);
    await run(task.id, "complete");

    expect(await completionRows(task.id)).toHaveLength(1);
  });

  it("skip and cancel close the occurrence without a Completion", async () => {
    const skipped = await createTask({ title: "Non avvenuto" });
    const cancelled = await createTask({ title: "Annullato" });

    expect((await run(skipped.id, "skip")).task?.status).toBe("skipped");
    expect((await run(cancelled.id, "cancel")).task?.status).toBe("cancelled");

    expect(await completionRows(skipped.id)).toHaveLength(0);
    expect(await completionRows(cancelled.id)).toHaveLength(0);
    expect(await history(skipped.id)).toEqual(["skipped"]);
    expect(await history(cancelled.id)).toEqual(["cancelled"]);

    const refused = await reopen(skipped.id);
    const error = errorEnvelopeSchema.safeParse(refused.body);
    expect(refused.status).toBe(422);
    if (error.success) expect(error.data.error.code).toBe("domain_rule_violation");
  });

  it("start and markTodo change only the working state; an in-progress task completes and reopens to in progress", async () => {
    const task = await createTask({ title: "Scrivere ADR" });

    expect((await run(task.id, "start")).task?.status).toBe("in_progress");
    expect((await run(task.id, "start")).task?.status).toBe("in_progress");
    expect((await run(task.id, "todo")).task?.status).toBe("open");
    expect(await completionRows(task.id)).toHaveLength(0);
    expect(await history(task.id)).toEqual([]);

    await run(task.id, "start");
    expect((await run(task.id, "complete")).task?.status).toBe("completed");

    const reopened = await reopen(task.id, "in_progress");
    const parsed = taskResponseSchema.safeParse(reopened.body);
    expect(reopened.status).toBe(200);
    if (parsed.success) expect(parsed.data.data.status).toBe("in_progress");
  });

  it("an overdue in-progress task stays overdue in the domain sense: its Schedule is unchanged", async () => {
    const task = await createTask({
      title: "Scaduto in corso",
      schedule: { allDay: true, from: null, to: "2026-01-02" },
    });

    const started = await run(task.id, "start");
    expect(started.task?.status).toBe("in_progress");
    expect(started.task?.schedule).toEqual({
      allDay: true,
      from: null,
      to: "2026-01-02",
      timeZone: "Europe/Rome",
    });
  });

  it("returns 404 for the history of an unknown task", async () => {
    const response = await get(`/api/tasks/${newId()}/history`);
    expect(response.status).toBe(404);
  });
});

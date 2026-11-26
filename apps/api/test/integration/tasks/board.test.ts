import { localDate } from "@nando/core";
import { newId } from "@nando/kernel";
import { afterAll, describe, expect, it } from "vitest";

import { boardResponseSchema, type BoardItemDto } from "@api/http/board/contract";
import { errorEnvelopeSchema } from "@api/http/envelope";
import {
  reopenTaskRequestFactory,
  taskCommandRequestFactory,
  taskHistoryResponseSchema,
} from "@api/http/tasks/contract";
import { createSpace, createTask, get, handle, post } from "./helpers";

afterAll(async () => {
  await handle.close();
});

const ROME = "Europe/Rome";
const today = localDate(new Date(), ROME);

/** Somma giorni a una data `YYYY-MM-DD` con aritmetica UTC. */
function addDays(date: string, days: number): string {
  const shifted = new Date(`${date}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

/**
 * Legge tutte le pagine del board. Ogni pagina deve passare lo schema
 * documentato; il cursore si segue finché è `null`.
 */
async function readBoard(query: string, limit = 100): Promise<BoardItemDto[]> {
  const items: BoardItemDto[] = [];
  let cursor: string | null = null;

  do {
    const cursorParam = cursor ? `&cursor=${encodeURIComponent(cursor)}` : "";
    const response = await get(`/api/board?${query}&limit=${limit}${cursorParam}`);
    const parsed = boardResponseSchema.safeParse(await response.json());

    expect(parsed.success).toBe(true);
    if (!parsed.success) throw new Error(JSON.stringify(parsed.error));

    items.push(...parsed.data.data.items);
    cursor = parsed.data.data.nextCursor;
  } while (cursor !== null);

  return items;
}

function findById(items: BoardItemDto[], taskId: string): BoardItemDto | undefined {
  return items.find((item) => item.id === taskId);
}

async function command(
  taskId: string,
  action: "complete" | "start" | "todo" | "reopen",
): Promise<void> {
  const body =
    action === "reopen"
      ? reopenTaskRequestFactory({ commandId: newId() })
      : taskCommandRequestFactory({ commandId: newId() });
  const response = await post(`/api/tasks/${taskId}/${action}`, body);

  expect(response.status).toBe(200);
}

async function history(taskId: string): Promise<string[]> {
  const response = await get(`/api/tasks/${taskId}/history`);
  const parsed = taskHistoryResponseSchema.safeParse(await response.json());

  expect(response.status).toBe(200);
  expect(parsed.success).toBe(true);
  if (!parsed.success) throw new Error(JSON.stringify(parsed.error));

  return parsed.data.data.items.map((item) => item.kind);
}

describe("board query", () => {
  it("returns an undated open task only without a horizon", async () => {
    const task = await createTask({ title: "Senza data al board" });

    const open = await readBoard("status=open");
    const horizon = await readBoard("status=open&horizon=7");

    expect(findById(open, task.id)).toMatchObject({
      id: task.id,
      status: "open",
      dueDate: null,
      temporalState: null,
    });
    expect(findById(horizon, task.id)).toBeUndefined();
  });

  it("orders open tasks by due date with undated last", async () => {
    const yesterday = await createTask({
      title: "Scaduto ieri al board",
      schedule: { allDay: true, from: null, to: addDays(today, -1) },
    });
    const soon = await createTask({
      title: "Fra tre giorni al board",
      schedule: { allDay: true, from: null, to: addDays(today, 3) },
    });
    const undated = await createTask({ title: "Senza data per ordine" });

    const items = await readBoard("status=open");
    const watched = new Set([yesterday.id, soon.id, undated.id]);
    const order = items.filter((item) => watched.has(item.id)).map((item) => item.id);

    expect(order).toEqual([yesterday.id, soon.id, undated.id]);
  });

  it("applies the due horizon, keeping overdue tasks and hiding undated ones", async () => {
    const inside = await createTask({
      title: "Fra sei giorni",
      schedule: { allDay: true, from: null, to: addDays(today, 6) },
    });
    const edge = await createTask({
      title: "Fra sette giorni",
      schedule: { allDay: true, from: null, to: addDays(today, 7) },
    });
    const overdue = await createTask({
      title: "Scaduto per orizzonte",
      schedule: { allDay: true, from: null, to: addDays(today, -1) },
    });

    const horizon7 = await readBoard("status=open&horizon=7");
    const horizon15 = await readBoard("status=open&horizon=15");

    expect(findById(horizon7, inside.id)).toMatchObject({
      id: inside.id,
      dueDate: addDays(today, 6),
    });
    expect(findById(horizon7, edge.id)).toBeUndefined();
    expect(findById(horizon15, edge.id)).toMatchObject({ id: edge.id });
    expect(findById(horizon7, overdue.id)).toMatchObject({
      id: overdue.id,
      temporalState: "overdue",
    });
  });

  it("filters by Space and still applies the horizon", async () => {
    const space = await createSpace("Board vita");
    const other = await createSpace("Board lavoro");
    const task = await createTask({
      title: "Nel board di vita",
      spaceId: space.id,
      schedule: { allDay: true, from: null, to: addDays(today, 3) },
    });

    const inSpace = await readBoard(`status=open&spaceId=${space.id}`);
    const inOther = await readBoard(`status=open&spaceId=${other.id}`);
    const withHorizon = await readBoard(`status=open&spaceId=${space.id}&horizon=30`);

    expect(findById(inSpace, task.id)).toMatchObject({ id: task.id, spaceId: space.id });
    expect(findById(inOther, task.id)).toBeUndefined();
    expect(findById(withHorizon, task.id)).toMatchObject({ id: task.id, spaceId: space.id });
  });

  it("moves a completed task to the done column and back on reopen", async () => {
    const task = await createTask({ title: "Da completare al board" });

    await command(task.id, "complete");

    const completed = await readBoard("status=completed");
    const completedItem = findById(completed, task.id);

    expect(completedItem).toMatchObject({
      id: task.id,
      status: "completed",
      completedAt: expect.any(String),
    });
    expect(findById(await readBoard("status=open"), task.id)).toBeUndefined();

    await command(task.id, "reopen");

    expect(findById(await readBoard("status=open"), task.id)).toMatchObject({
      id: task.id,
      status: "open",
    });
    expect(findById(await readBoard("status=completed"), task.id)).toBeUndefined();

    const kinds = await history(task.id);

    expect(kinds).toHaveLength(2);
    expect(kinds).toEqual(expect.arrayContaining(["completed", "reopened"]));
  });

  it("moves a task to in progress and back without a Completion", async () => {
    const task = await createTask({ title: "Da avviare al board" });

    await command(task.id, "start");

    expect(findById(await readBoard("status=in_progress"), task.id)).toMatchObject({
      id: task.id,
      status: "in_progress",
    });

    await command(task.id, "todo");

    expect(findById(await readBoard("status=open"), task.id)).toMatchObject({
      id: task.id,
      status: "open",
    });
    expect(await history(task.id)).toEqual([]);
  });

  it("follows the cursor through a Space with one item per page", async () => {
    const space = await createSpace("Board pagine");
    const first = await createTask({
      title: "Pagina uno",
      spaceId: space.id,
      schedule: { allDay: true, from: null, to: addDays(today, 1) },
    });
    const second = await createTask({
      title: "Pagina due",
      spaceId: space.id,
      schedule: { allDay: true, from: null, to: addDays(today, 2) },
    });
    const third = await createTask({
      title: "Pagina tre",
      spaceId: space.id,
      schedule: { allDay: true, from: null, to: addDays(today, 3) },
    });

    const items = await readBoard(`status=open&spaceId=${space.id}`, 1);

    expect(items.map((item) => item.id)).toEqual([first.id, second.id, third.id]);
  });

  it("rejects an unknown status or horizon", async () => {
    const skipped = await get("/api/board?status=skipped");
    const skippedParsed = errorEnvelopeSchema.safeParse(await skipped.json());

    expect(skipped.status).toBe(400);
    expect(skippedParsed.success).toBe(true);
    if (skippedParsed.success) {
      expect(skippedParsed.data.error.code).toBe("validation_error");
    }

    const horizon = await get("/api/board?status=open&horizon=5");
    const horizonParsed = errorEnvelopeSchema.safeParse(await horizon.json());

    expect(horizon.status).toBe(400);
    expect(horizonParsed.success).toBe(true);
    if (horizonParsed.success) {
      expect(horizonParsed.data.error.code).toBe("validation_error");
    }
  });
});

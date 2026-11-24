import { localDate } from "@nando/core";
import { newId } from "@nando/kernel";
import { afterAll, describe, expect, it } from "vitest";

import { agendaResponseSchema, type AgendaItemDto } from "@api/http/agenda/contract";
import { errorEnvelopeSchema } from "@api/http/envelope";
import { taskCommandRequestFactory } from "@api/http/tasks/contract";
import { createTask, get, handle, post } from "./helpers";

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
 * Legge tutte le pagine dell'agenda. Ogni pagina deve passare lo schema
 * documentato; il cursore si segue finché è `null`.
 */
async function readAgenda(query: string): Promise<AgendaItemDto[]> {
  const items: AgendaItemDto[] = [];
  let cursor: string | null = null;

  do {
    const cursorParam = cursor ? `&cursor=${encodeURIComponent(cursor)}` : "";
    const response = await get(`/api/agenda?${query}&limit=100${cursorParam}`);
    const parsed = agendaResponseSchema.safeParse(await response.json());

    expect(parsed.success).toBe(true);
    if (!parsed.success) throw new Error(JSON.stringify(parsed.error));

    items.push(...parsed.data.data.items);
    cursor = parsed.data.data.nextCursor;
  } while (cursor !== null);

  return items;
}

function findById(items: AgendaItemDto[], taskId: string): AgendaItemDto | undefined {
  return items.find((item) => item.id === taskId);
}

describe("agenda query", () => {
  it("returns an all-day task due today as upcoming", async () => {
    const task = await createTask({
      title: "Scadenza di oggi",
      schedule: { allDay: true, from: null, to: today },
    });

    const items = await readAgenda(`from=${today}&to=${today}`);

    expect(findById(items, task.id)).toMatchObject({
      id: task.id,
      temporalState: "upcoming",
      dueDate: today,
      startDate: null,
    });
  });

  it("returns an overdue task only with includeOverdue", async () => {
    const task = await createTask({
      title: "Scaduto ieri",
      schedule: { allDay: true, from: null, to: addDays(today, -1) },
    });

    const withoutOverdue = await readAgenda(`from=${today}&to=${today}`);
    const withOverdue = await readAgenda(`from=${today}&to=${today}&includeOverdue=true`);

    expect(findById(withoutOverdue, task.id)).toBeUndefined();
    expect(findById(withOverdue, task.id)).toMatchObject({
      id: task.id,
      temporalState: "overdue",
    });
  });

  it("never returns a task without a Schedule", async () => {
    const task = await createTask({ title: "Senza scadenza" });

    const withoutOverdue = await readAgenda(`from=${today}&to=${today}`);
    const withOverdue = await readAgenda(`from=${today}&to=${today}&includeOverdue=true`);

    expect(findById(withoutOverdue, task.id)).toBeUndefined();
    expect(findById(withOverdue, task.id)).toBeUndefined();
  });

  it("returns a range that covers today as current", async () => {
    const start = addDays(today, -1);
    const task = await createTask({
      title: "Intervallo iniziato",
      schedule: { allDay: true, from: start, to: addDays(today, 1) },
    });

    const items = await readAgenda(`from=${today}&to=${today}`);

    expect(findById(items, task.id)).toMatchObject({
      id: task.id,
      temporalState: "current",
      startDate: start,
    });
  });

  it("evaluates a timed point in the Task time zone", async () => {
    // 23:30 UTC a Roma è già il giorno successivo: il punto cade su today+3.
    const task = await createTask({
      title: "Punto serale",
      schedule: { allDay: false, from: null, to: `${addDays(today, 2)}T23:30:00.000Z` },
    });

    const nextLocalDay = await readAgenda(`from=${addDays(today, 3)}&to=${addDays(today, 3)}`);
    const twoDaysAhead = await readAgenda(`from=${addDays(today, 2)}&to=${addDays(today, 2)}`);

    expect(findById(nextLocalDay, task.id)).toMatchObject({
      id: task.id,
      dueDate: addDays(today, 3),
    });
    expect(findById(twoDaysAhead, task.id)).toBeUndefined();
  });

  it("hides a completed task and keeps a started one", async () => {
    const completed = await createTask({
      title: "Da completare",
      schedule: { allDay: true, from: null, to: today },
    });
    const started = await createTask({
      title: "Da iniziare",
      schedule: { allDay: true, from: null, to: today },
    });

    const completedResponse = await post(
      `/api/tasks/${completed.id}/complete`,
      taskCommandRequestFactory({ commandId: newId() }),
    );
    const startedResponse = await post(
      `/api/tasks/${started.id}/start`,
      taskCommandRequestFactory({ commandId: newId() }),
    );

    expect(completedResponse.status).toBe(200);
    expect(startedResponse.status).toBe(200);

    const items = await readAgenda(`from=${today}&to=${today}`);

    expect(findById(items, completed.id)).toBeUndefined();
    expect(findById(items, started.id)).toMatchObject({
      id: started.id,
      status: "in_progress",
    });
  });

  it("rejects an inverted or too wide range", async () => {
    const inverted = await get(`/api/agenda?from=${addDays(today, 1)}&to=${today}`);
    const invertedParsed = errorEnvelopeSchema.safeParse(await inverted.json());

    expect(inverted.status).toBe(400);
    expect(invertedParsed.success).toBe(true);
    if (invertedParsed.success) {
      expect(invertedParsed.data.error.code).toBe("validation_error");
    }

    // Estremi inclusi: today..today+61 sono 62 giorni, today+62 è il sessantatreesimo.
    const widest = await get(`/api/agenda?from=${today}&to=${addDays(today, 61)}`);

    expect(widest.status).toBe(200);

    const tooWide = await get(`/api/agenda?from=${today}&to=${addDays(today, 62)}`);
    const tooWideParsed = errorEnvelopeSchema.safeParse(await tooWide.json());

    expect(tooWide.status).toBe(400);
    expect(tooWideParsed.success).toBe(true);
    if (tooWideParsed.success) {
      expect(tooWideParsed.data.error.code).toBe("validation_error");
    }
  });
});

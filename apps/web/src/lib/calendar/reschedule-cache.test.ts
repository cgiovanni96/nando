import { describe, expect, it } from "vitest";

import type { AgendaItem } from "@web/lib/queries/agenda";
import type { TaskItem } from "@web/lib/queries/tasks";

import { placeInCalendar, withSchedule } from "./reschedule-cache";

const TIME_ZONE = "Europe/Rome";

const baseItem: AgendaItem = {
  id: "0199a4c2-7a10-7000-8000-000000000301",
  title: "Comprare il pane",
  status: "open",
  schedule: { allDay: true, from: null, to: "2026-11-12", timeZone: TIME_ZONE },
  timeZone: TIME_ZONE,
  spaceId: null,
  version: 1,
  createdAt: "2026-11-12T09:00:00.000Z",
  updatedAt: "2026-11-12T09:00:00.000Z",
  deletedAt: null,
  restorableUntil: null,
  temporalState: "upcoming",
  dueDate: "2026-11-12",
  startDate: null,
};

function item(overrides: Partial<AgendaItem> = {}): AgendaItem {
  return { ...baseItem, ...overrides };
}

function task(overrides: Partial<TaskItem> = {}): TaskItem {
  return {
    id: baseItem.id,
    title: baseItem.title,
    status: baseItem.status,
    schedule: baseItem.schedule,
    timeZone: baseItem.timeZone,
    spaceId: baseItem.spaceId,
    version: baseItem.version,
    createdAt: baseItem.createdAt,
    updatedAt: baseItem.updatedAt,
    deletedAt: baseItem.deletedAt,
    restorableUntil: baseItem.restorableUntil,
    ...overrides,
  };
}

function allDay(from: string | null, to: string) {
  return { allDay: true as const, from, to };
}

function timed(from: string | null, to: string) {
  return { allDay: false as const, from, to };
}

describe("withSchedule", () => {
  it("keeps the all-day date and leaves the start of a point null", () => {
    const result = withSchedule(item(), allDay(null, "2026-11-12"));

    expect(result.schedule).toEqual({
      allDay: true,
      from: null,
      to: "2026-11-12",
      timeZone: TIME_ZONE,
    });
    expect(result.dueDate).toBe("2026-11-12");
    expect(result.startDate).toBeNull();
  });

  it("keeps both ends of an all-day range", () => {
    const result = withSchedule(item(), allDay("2026-11-10", "2026-11-14"));

    expect(result.dueDate).toBe("2026-11-14");
    expect(result.startDate).toBe("2026-11-10");
  });

  it("reads the day of a timed point in the task timezone", () => {
    const result = withSchedule(item(), timed(null, "2026-11-25T09:45:00.000Z"));

    expect(result.schedule).toEqual({
      allDay: false,
      from: null,
      to: "2026-11-25T09:45:00.000Z",
      timeZone: TIME_ZONE,
    });
    expect(result.dueDate).toBe("2026-11-25");
    expect(result.startDate).toBeNull();
  });

  it("reads both ends of a timed range in the task timezone", () => {
    const result = withSchedule(
      item(),
      timed("2026-11-25T23:30:00.000Z", "2026-11-26T01:00:00.000Z"),
    );

    expect(result.startDate).toBe("2026-11-26");
    expect(result.dueDate).toBe("2026-11-26");
  });

  it("takes the day in the task timezone when it differs from the UTC day", () => {
    const result = withSchedule(
      item({ timeZone: "America/New_York" }),
      timed(null, "2026-11-26T02:00:00.000Z"),
    );

    expect(result.schedule.timeZone).toBe("America/New_York");
    expect(result.dueDate).toBe("2026-11-25");
  });

  it("keeps the temporal state the task already has", () => {
    const result = withSchedule(item({ temporalState: "current" }), allDay(null, "2026-11-12"));

    expect(result.temporalState).toBe("current");
  });

  it("falls back to upcoming when the task has no temporal state", () => {
    expect(withSchedule(task(), allDay(null, "2026-11-12")).temporalState).toBe("upcoming");
    expect(
      withSchedule(item({ temporalState: null }), allDay(null, "2026-11-12")).temporalState,
    ).toBe("upcoming");
  });

  it("does not mutate the task", () => {
    const source = item();
    const snapshot = JSON.stringify(source);

    withSchedule(source, allDay("2026-11-10", "2026-11-14"));

    expect(JSON.stringify(source)).toBe(snapshot);
  });
});

describe("placeInCalendar", () => {
  const range = { from: "2026-11-23", to: "2026-11-29" };

  it("replaces the item with the same id where it was", () => {
    const other = item({ id: "other", dueDate: "2026-11-24", startDate: null });
    const moved = item({ dueDate: "2026-11-26", startDate: null });

    const result = placeInCalendar([other, item()], moved, range);

    expect(result).toEqual([other, moved]);
    expect(result.at(-1)).toBe(moved);
  });

  it("appends an item that falls inside the range", () => {
    const moved = item({ id: "new", dueDate: "2026-11-25", startDate: null });

    const result = placeInCalendar([item({ id: "other" })], moved, range);

    expect(result).toHaveLength(2);
    expect(result.at(-1)).toBe(moved);
  });

  it("appends a range that only touches the bounds", () => {
    const moved = item({ id: "new", startDate: "2026-11-29", dueDate: "2026-12-02" });

    expect(placeInCalendar([], moved, range)).toEqual([moved]);
  });

  it("skips an item outside the range", () => {
    const before = item({ id: "new", dueDate: "2026-11-22", startDate: null });
    const after = item({ id: "new", startDate: "2026-11-30", dueDate: "2026-12-02" });

    expect(placeInCalendar([], before, range)).toEqual([]);
    expect(placeInCalendar([], after, range)).toEqual([]);
  });

  it("does not mutate the items it receives", () => {
    const items = [item()];
    const snapshot = JSON.stringify(items);

    placeInCalendar(items, item({ dueDate: "2026-11-26" }), range);
    placeInCalendar(items, item({ id: "new", dueDate: "2026-11-26" }), range);

    expect(JSON.stringify(items)).toBe(snapshot);
  });
});

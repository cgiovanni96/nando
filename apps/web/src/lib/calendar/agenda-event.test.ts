import { describe, expect, it } from "vitest";

import type { AgendaItem } from "@web/lib/queries/agenda";

import {
  POINT_MINUTES,
  allDayRows,
  clipToDay,
  inRange,
  isAllDayRow,
  shiftDate,
  toCalendarEvent,
  toWeekEvents,
  viewRange,
} from "./agenda-event";

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

function allDaySchedule(from: string | null, to: string, timeZone = TIME_ZONE) {
  return { allDay: true as const, from, to, timeZone };
}

function timedSchedule(from: string | null, to: string, timeZone = TIME_ZONE) {
  return { allDay: false as const, from, to, timeZone };
}

function event(schedule: AgendaItem["schedule"], overrides: Partial<AgendaItem> = {}) {
  return toCalendarEvent(item({ schedule, ...overrides }));
}

describe("toCalendarEvent", () => {
  it("maps an all-day occurrence to a full day", () => {
    const result = event(allDaySchedule(null, "2026-11-25"));

    expect(result.payload.kind).toBe("allDay");
    expect(result.start).toBe("2026-11-25 00:00:00");
    expect(result.end).toBe("2026-11-26 00:00:00");
  });

  it("treats an all-day schedule with equal from and to as a single day", () => {
    const result = event(allDaySchedule("2026-11-25", "2026-11-25"));

    expect(result.payload.kind).toBe("allDay");
    expect(result.start).toBe("2026-11-25 00:00:00");
    expect(result.end).toBe("2026-11-26 00:00:00");
  });

  it("maps an all-day range to whole days, next day included", () => {
    const result = event(allDaySchedule("2026-11-23", "2026-11-25"));

    expect(result.payload.kind).toBe("allDayRange");
    expect(result.start).toBe("2026-11-23 00:00:00");
    expect(result.end).toBe("2026-11-26 00:00:00");
  });

  it("maps a timed occurrence without from to a 30 minute point", () => {
    const result = event(timedSchedule(null, "2026-11-25T09:45:00.000Z"));

    expect(result.payload.kind).toBe("point");
    expect(result.start).toBe("2026-11-25 10:45:00");
    expect(result.end).toBe("2026-11-25 11:15:00");
  });

  it("keeps a timed range and its end", () => {
    const result = event(timedSchedule("2026-11-25T09:45:00.000Z", "2026-11-25T11:00:00.000Z"));

    expect(result.payload.kind).toBe("range");
    expect(result.start).toBe("2026-11-25 10:45:00");
    expect(result.end).toBe("2026-11-25 12:00:00");
  });

  it("clamps a point at 23:45 to the end of its day", () => {
    const result = event(timedSchedule(null, "2026-11-25T22:45:00.000Z"));

    expect(POINT_MINUTES).toBe(30);
    expect(result.start).toBe("2026-11-25 23:45:00");
    expect(result.end).toBe("2026-11-25 23:59:59");
  });

  it("moves a point at 00:00 by 30 minutes", () => {
    const result = event(timedSchedule(null, "2026-11-24T23:00:00.000Z"));

    expect(result.start).toBe("2026-11-25 00:00:00");
    expect(result.end).toBe("2026-11-25 00:30:00");
  });

  it("keeps a range across midnight", () => {
    const result = event(timedSchedule("2026-11-25T21:00:00.000Z", "2026-11-26T00:00:00.000Z"));

    expect(result.payload.kind).toBe("range");
    expect(result.start).toBe("2026-11-25 22:00:00");
    expect(result.end).toBe("2026-11-26 01:00:00");
  });

  it("falls back to a point end when the clock goes back, 2026-10-25 in Rome", () => {
    const result = event(timedSchedule("2026-10-25T00:45:00.000Z", "2026-10-25T01:15:00.000Z"));

    expect(result.payload.kind).toBe("range");
    expect(result.start).toBe("2026-10-25 02:45:00");
    expect(result.end).toBe("2026-10-25 03:15:00");
  });

  it("keeps a range that crosses the missing hour, 2026-03-29 in Rome", () => {
    const result = event(timedSchedule("2026-03-29T00:30:00.000Z", "2026-03-29T01:30:00.000Z"));

    expect(result.start).toBe("2026-03-29 01:30:00");
    expect(result.end).toBe("2026-03-29 03:30:00");
  });

  it("reads the wall clock in the task's timezone", () => {
    const result = event(
      timedSchedule("2026-11-25T15:00:00.000Z", "2026-11-25T17:30:00.000Z", "America/New_York"),
    );

    expect(result.start).toBe("2026-11-25 10:00:00");
    expect(result.end).toBe("2026-11-25 12:30:00");
  });

  it("colors an overdue occurrence red and carries id, title and payload", () => {
    const source = item({
      id: "overdue",
      title: "Ritardo",
      temporalState: "overdue",
      schedule: allDaySchedule(null, "2026-11-25"),
    });

    const result = toCalendarEvent(source);

    expect(result.color).toBe("red");
    expect(result.id).toBe("overdue");
    expect(result.title).toBe("Ritardo");
    expect(result.payload).toEqual({ item: source, kind: "allDay" });
  });

  it("leaves a non-overdue occurrence gray", () => {
    expect(event(allDaySchedule(null, "2026-11-25")).color).toBe("gray");
  });
});

describe("clipToDay", () => {
  const longRange = event(timedSchedule("2026-11-23T21:00:00.000Z", "2026-11-26T01:00:00.000Z"));

  it("cuts the first day of a range", () => {
    const [result] = clipToDay([longRange], "2026-11-23");

    expect(result?.start).toBe("2026-11-23 22:00:00");
    expect(result?.end).toBe("2026-11-24 00:00:00");
  });

  it("gives a middle day the whole day", () => {
    const [result] = clipToDay([longRange], "2026-11-24");

    expect(result?.start).toBe("2026-11-24 00:00:00");
    expect(result?.end).toBe("2026-11-25 00:00:00");
  });

  it("cuts the last day of a range", () => {
    const [result] = clipToDay([longRange], "2026-11-26");

    expect(result?.start).toBe("2026-11-26 00:00:00");
    expect(result?.end).toBe("2026-11-26 02:00:00");
  });

  it("keeps a full day unchanged", () => {
    const [result] = clipToDay([event(allDaySchedule(null, "2026-11-25"))], "2026-11-25");

    expect(result?.start).toBe("2026-11-25 00:00:00");
    expect(result?.end).toBe("2026-11-26 00:00:00");
  });

  it("leaves out an event that ends exactly at the start of the day", () => {
    const previous = event(allDaySchedule(null, "2026-11-24"));

    expect(clipToDay([previous], "2026-11-25")).toEqual([]);
    expect(clipToDay([previous], "2026-11-24")).toHaveLength(1);
  });

  it("does not mutate the input events", () => {
    const events = [longRange];
    const snapshot = JSON.stringify(events);

    clipToDay(events, "2026-11-23");

    expect(JSON.stringify(events)).toBe(snapshot);
    expect(events).toEqual([longRange]);
  });
});

describe("inRange", () => {
  const longRange = event(timedSchedule("2026-11-23T21:00:00.000Z", "2026-11-26T01:00:00.000Z"));

  it("includes the days an event overlaps without cutting it", () => {
    expect(inRange([longRange], "2026-11-26", "2026-11-26")).toEqual([longRange]);
    expect(inRange([longRange], "2026-11-24", "2026-11-25")).toEqual([longRange]);
  });

  it("leaves out an event that ends exactly at from 00:00", () => {
    const previous = event(allDaySchedule(null, "2026-11-24"));

    expect(inRange([previous], "2026-11-25", "2026-11-25")).toEqual([]);
    expect(inRange([previous], "2026-11-24", "2026-11-24")).toEqual([previous]);
  });

  it("leaves out an event that starts exactly after to", () => {
    const next = event(allDaySchedule(null, "2026-11-26"));

    expect(inRange([next], "2026-11-25", "2026-11-25")).toEqual([]);
    expect(inRange([next], "2026-11-26", "2026-11-26")).toEqual([next]);
  });
});

describe("isAllDayRow", () => {
  it("treats an all-day occurrence and an all-day range as header rows", () => {
    expect(isAllDayRow(event(allDaySchedule(null, "2026-11-25")))).toBe(true);
    expect(isAllDayRow(event(allDaySchedule("2026-11-23", "2026-11-25")))).toBe(true);
  });

  it("treats a range ending after midnight as a header row", () => {
    expect(
      isAllDayRow(event(timedSchedule("2026-11-25T21:00:00.000Z", "2026-11-26T00:00:00.000Z"))),
    ).toBe(true);
  });

  it("keeps a point and a range ending at midnight in the grid", () => {
    expect(isAllDayRow(event(timedSchedule(null, "2026-11-25T09:45:00.000Z")))).toBe(false);
    expect(
      isAllDayRow(event(timedSchedule("2026-11-25T21:00:00.000Z", "2026-11-25T23:00:00.000Z"))),
    ).toBe(false);
  });
});

describe("toWeekEvents", () => {
  const multiDay = event(timedSchedule("2026-11-24T09:00:00.000Z", "2026-11-26T17:30:00.000Z"));

  it("turns a multi-day occurrence into whole days", () => {
    const [result] = toWeekEvents([multiDay]);

    expect(result?.start).toBe("2026-11-24 00:00:00");
    expect(result?.end).toBe("2026-11-27 00:00:00");
  });

  it("keeps a same-day occurrence as the same reference", () => {
    const sameDay = event(timedSchedule("2026-11-25T09:45:00.000Z", "2026-11-25T11:00:00.000Z"));
    const [result] = toWeekEvents([sameDay]);

    expect(result).toBe(sameDay);
  });

  it("does not mutate the input events", () => {
    const events = [multiDay];
    const snapshot = JSON.stringify(events);

    toWeekEvents(events);

    expect(JSON.stringify(events)).toBe(snapshot);
    expect(events).toEqual([multiDay]);
  });
});

describe("allDayRows", () => {
  const multiDay = event(timedSchedule("2026-11-24T09:00:00.000Z", "2026-11-26T17:30:00.000Z"));
  const overnight = event(timedSchedule("2026-11-26T21:00:00.000Z", "2026-11-27T00:30:00.000Z"));

  it("counts the busiest day of the interval", () => {
    expect(allDayRows([multiDay, overnight], "2026-11-26", "2026-11-26")).toBe(2);
    expect(allDayRows([multiDay, overnight], "2026-11-24", "2026-11-24")).toBe(1);
  });

  it("leaves out an event outside from and to", () => {
    const outside = event(timedSchedule("2026-11-10T09:00:00.000Z", "2026-11-11T17:30:00.000Z"));

    expect(allDayRows([outside], "2026-11-26", "2026-11-26")).toBe(0);
  });

  it("returns 0 when no event reaches the header", () => {
    const sameDay = event(timedSchedule("2026-11-26T09:45:00.000Z", "2026-11-26T11:00:00.000Z"));

    expect(allDayRows([sameDay], "2026-11-26", "2026-11-26")).toBe(0);
    expect(allDayRows([], "2026-11-26", "2026-11-26")).toBe(0);
  });
});

describe("viewRange", () => {
  it("starts the month on the Monday before the 1st and covers 42 days", () => {
    expect(viewRange("month", "2026-11-25")).toEqual({
      from: "2026-10-26",
      to: "2026-12-06",
    });
  });

  it("starts a month that begins on Monday on its first day", () => {
    expect(viewRange("month", "2026-06-15")).toEqual({
      from: "2026-06-01",
      to: "2026-07-12",
    });
  });

  it("covers Monday to Sunday for the week", () => {
    expect(viewRange("week", "2026-11-25")).toEqual({
      from: "2026-11-23",
      to: "2026-11-29",
    });
    expect(viewRange("week", "2026-11-29")).toEqual({
      from: "2026-11-23",
      to: "2026-11-29",
    });
  });

  it("covers the day itself", () => {
    expect(viewRange("day", "2026-11-25")).toEqual({
      from: "2026-11-25",
      to: "2026-11-25",
    });
  });

  it("covers fourteen days for the agenda", () => {
    expect(viewRange("agenda", "2026-11-25")).toEqual({
      from: "2026-11-25",
      to: "2026-12-08",
    });
  });
});

describe("shiftDate", () => {
  it("moves month to the first day of the adjacent month across the year", () => {
    expect(shiftDate("month", "2026-12-15", 1)).toBe("2027-01-01");
    expect(shiftDate("month", "2026-01-15", -1)).toBe("2025-12-01");
  });

  it("moves week by seven days across the year", () => {
    expect(shiftDate("week", "2026-12-30", 1)).toBe("2027-01-06");
    expect(shiftDate("week", "2027-01-01", -1)).toBe("2026-12-25");
  });

  it("moves day by one day across the year", () => {
    expect(shiftDate("day", "2026-12-31", 1)).toBe("2027-01-01");
    expect(shiftDate("day", "2027-01-01", -1)).toBe("2026-12-31");
  });

  it("moves agenda by fourteen days", () => {
    expect(shiftDate("agenda", "2026-11-25", 1)).toBe("2026-12-09");
    expect(shiftDate("agenda", "2026-11-25", -1)).toBe("2026-11-11");
  });
});

import { describe, expect, it } from "vitest";

import type { AgendaItem } from "@web/lib/queries/agenda";

import { formatScheduleLabel, formatScheduleTime } from "./schedule";

const TIME_ZONE = "Europe/Rome";

const baseItem: AgendaItem = {
  id: "0199a4c2-7a10-7000-8000-000000000301",
  title: "Comprare il pane",
  status: "open",
  schedule: { allDay: true, from: null, to: "2026-11-25", timeZone: TIME_ZONE },
  timeZone: TIME_ZONE,
  spaceId: null,
  version: 1,
  createdAt: "2026-11-25T09:00:00.000Z",
  updatedAt: "2026-11-25T09:00:00.000Z",
  deletedAt: null,
  restorableUntil: null,
  temporalState: "upcoming",
  dueDate: "2026-11-25",
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

describe("formatScheduleTime", () => {
  it("returns null for a whole day", () => {
    expect(formatScheduleTime(item({ schedule: allDaySchedule(null, "2026-11-25") }))).toBeNull();
    expect(
      formatScheduleTime(item({ schedule: allDaySchedule("2026-11-23", "2026-11-25") })),
    ).toBeNull();
  });

  it("prints the time of a point", () => {
    const value = item({ schedule: timedSchedule(null, "2026-11-25T09:45:00.000Z") });

    expect(formatScheduleTime(value)).toBe("10:45");
  });

  it("prints a same-day range", () => {
    const value = item({
      schedule: timedSchedule("2026-11-25T09:45:00.000Z", "2026-11-25T11:00:00.000Z"),
    });

    expect(formatScheduleTime(value)).toBe("10:45 – 12:00");
  });

  it("prints the two times of a range across midnight", () => {
    const value = item({
      schedule: timedSchedule("2026-11-25T21:00:00.000Z", "2026-11-26T00:00:00.000Z"),
    });

    expect(formatScheduleTime(value)).toBe("22:00 – 01:00");
  });

  it("prints the real end of a range over the end of daylight saving", () => {
    const value = item({
      schedule: timedSchedule("2026-10-25T00:45:00.000Z", "2026-10-25T01:15:00.000Z"),
    });

    expect(formatScheduleTime(value)).toBe("02:45 – 02:15");
  });

  it("reads the time in the task's timezone", () => {
    const value = item({
      schedule: timedSchedule(
        "2026-11-25T15:00:00.000Z",
        "2026-11-25T17:00:00.000Z",
        "America/New_York",
      ),
    });

    expect(formatScheduleTime(value)).toBe("10:00 – 12:00");
  });
});

describe("formatScheduleLabel", () => {
  it("labels a single all-day day", () => {
    expect(formatScheduleLabel(item({ schedule: allDaySchedule(null, "2026-11-25") }))).toBe(
      "25 nov",
    );
  });

  it("labels an all-day range by its inclusive days", () => {
    expect(
      formatScheduleLabel(item({ schedule: allDaySchedule("2026-11-23", "2026-11-25") })),
    ).toBe("23 nov – 25 nov");
  });

  it("labels a point with its day and time", () => {
    const value = item({ schedule: timedSchedule(null, "2026-11-25T09:45:00.000Z") });

    expect(formatScheduleLabel(value)).toBe("25 nov, 10:45");
  });

  it("labels a same-day range once", () => {
    const value = item({
      schedule: timedSchedule("2026-11-25T09:45:00.000Z", "2026-11-25T11:00:00.000Z"),
    });

    expect(formatScheduleLabel(value)).toBe("25 nov, 10:45 – 12:00");
  });

  it("repeats the day for a range across midnight", () => {
    const value = item({
      schedule: timedSchedule("2026-11-25T21:00:00.000Z", "2026-11-26T00:00:00.000Z"),
    });

    expect(formatScheduleLabel(value)).toBe("25 nov, 22:00 – 26 nov, 01:00");
  });

  it("labels the real end of a range over the end of daylight saving", () => {
    const value = item({
      schedule: timedSchedule("2026-10-25T00:45:00.000Z", "2026-10-25T01:15:00.000Z"),
    });

    expect(formatScheduleLabel(value)).toBe("25 ott, 02:45 – 02:15");
  });
});

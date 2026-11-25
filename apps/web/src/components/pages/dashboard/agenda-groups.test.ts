import { describe, expect, it } from "vitest";

import type { AgendaItem } from "@web/lib/queries/agenda";
import {
  NEXT_DAYS,
  type TodayGroup,
  groupNextDays,
  groupToday,
  limitGroups,
} from "./agenda-groups";

const TODAY = "2026-11-12";
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
  dueDate: TODAY,
  startDate: null,
};

function item(overrides: Partial<AgendaItem> = {}): AgendaItem {
  return { ...baseItem, ...overrides };
}

function allDaySchedule(from: string | null, to: string) {
  return { allDay: true as const, from, to, timeZone: TIME_ZONE };
}

function timedSchedule(to: string) {
  return { allDay: false as const, from: null, to, timeZone: TIME_ZONE };
}

function threeGroups(): TodayGroup[] {
  return [
    { key: "overdue", total: 3, items: ["a1", "a2", "a3"].map((id) => item({ id })) },
    { key: "current", total: 3, items: ["b1", "b2", "b3"].map((id) => item({ id })) },
    { key: "dueToday", total: 3, items: ["c1", "c2", "c3"].map((id) => item({ id })) },
  ];
}

describe("groupToday", () => {
  it("fills the three groups in order and leaves tomorrow out of Oggi", () => {
    const result = groupToday(
      [
        item({ id: "overdue", temporalState: "overdue", dueDate: "2026-11-10" }),
        item({
          id: "current",
          temporalState: "current",
          dueDate: "2026-11-14",
          startDate: "2026-11-10",
          status: "in_progress",
          schedule: allDaySchedule("2026-11-10", "2026-11-14"),
        }),
        item({ id: "due-today", temporalState: "upcoming", dueDate: TODAY }),
        item({ id: "tomorrow", temporalState: "upcoming", dueDate: "2026-11-13" }),
      ],
      TODAY,
    );

    expect(result.groups.map((group) => group.key)).toEqual(["overdue", "current", "dueToday"]);
    expect(result.groups.map((group) => group.items.map((entry) => entry.id))).toEqual([
      ["overdue"],
      ["current"],
      ["due-today"],
    ]);
    expect(result.total).toBe(3);
  });

  it("does not change the group when the working status is in_progress", () => {
    const result = groupToday(
      [
        item({
          id: "started-late",
          status: "in_progress",
          temporalState: "overdue",
          dueDate: "2026-11-10",
        }),
        item({ id: "open-late", status: "open", temporalState: "overdue", dueDate: "2026-11-11" }),
      ],
      TODAY,
    );

    const overdue = result.groups.find((group) => group.key === "overdue");

    expect(overdue?.items.map((entry) => entry.id)).toEqual(["started-late", "open-late"]);
  });

  it("orders a group by due date, timings before all-day entries, then title", () => {
    const result = groupToday(
      [
        item({
          id: "all-day",
          title: "B",
          temporalState: "overdue",
          dueDate: "2026-11-10",
          schedule: allDaySchedule(null, "2026-11-10"),
        }),
        item({
          id: "timed",
          title: "Z",
          temporalState: "overdue",
          dueDate: "2026-11-10",
          schedule: timedSchedule("2026-11-10T18:00:00.000Z"),
        }),
        item({ id: "earlier", temporalState: "overdue", dueDate: "2026-11-09" }),
      ],
      TODAY,
    );

    const overdue = result.groups.find((group) => group.key === "overdue");

    expect(overdue?.items.map((entry) => entry.id)).toEqual(["earlier", "timed", "all-day"]);
  });
});

describe("limitGroups", () => {
  it("spends the budget across groups in order", () => {
    expect(limitGroups(threeGroups(), 7).map((group) => group.items.length)).toEqual([3, 3, 1]);
  });

  it("keeps the full size of a group whose rows are cut", () => {
    expect(limitGroups(threeGroups(), 7).map((group) => group.total)).toEqual([3, 3, 3]);

    const dueToday = Array.from({ length: 8 }, (_, index) => item({ id: `due-${index}` }));
    const [group] = limitGroups(groupToday(dueToday, TODAY).groups, 7);

    expect(group?.items).toHaveLength(7);
    expect(group?.total).toBe(8);
  });

  it("drops the later groups once the budget is exhausted", () => {
    expect(limitGroups(threeGroups(), 3).map((group) => group.key)).toEqual(["overdue"]);
  });

  it("keeps every row with a null limit", () => {
    const groups = threeGroups();

    expect(limitGroups(groups, null)).toEqual(groups);
  });

  it("drops empty groups with and without a limit", () => {
    const { groups } = groupToday([item({ id: "due-today" })], TODAY);

    expect(limitGroups(groups, 7).map((group) => group.key)).toEqual(["dueToday"]);
    expect(limitGroups(groups, null).map((group) => group.key)).toEqual(["dueToday"]);
  });
});

describe("groupNextDays", () => {
  it("returns six days starting tomorrow, empty days included", () => {
    const result = groupNextDays([], TODAY);

    expect(result.days).toHaveLength(NEXT_DAYS);
    expect(result.days.map((day) => day.date)).toEqual([
      "2026-11-13",
      "2026-11-14",
      "2026-11-15",
      "2026-11-16",
      "2026-11-17",
      "2026-11-18",
    ]);
    expect(result.total).toBe(0);
  });

  it("shows a range on its start day and on its due day", () => {
    const range = item({
      id: "range",
      startDate: "2026-11-14",
      dueDate: "2026-11-16",
      schedule: allDaySchedule("2026-11-14", "2026-11-16"),
    });

    const result = groupNextDays([range], TODAY);
    const day = (date: string) => result.days.find((entry) => entry.date === date);

    expect(day("2026-11-14")?.entries).toEqual([{ item: range, starts: true }]);
    expect(day("2026-11-16")?.entries).toEqual([{ item: range, starts: false }]);
    expect(day("2026-11-15")?.entries).toEqual([]);
    expect(result.total).toBe(2);
  });

  it("keeps a range started before the window only on its due day", () => {
    const range = item({
      id: "long-range",
      startDate: "2026-11-01",
      dueDate: "2026-11-15",
      schedule: allDaySchedule("2026-11-01", "2026-11-15"),
    });

    const result = groupNextDays([range], TODAY);

    expect(result.days.flatMap((day) => day.entries)).toEqual([{ item: range, starts: false }]);
  });

  it("leaves out an item due today", () => {
    const result = groupNextDays([item({ id: "today", dueDate: TODAY })], TODAY);

    expect(result.total).toBe(0);
  });
});

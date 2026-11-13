import { describe, expect, it } from "vitest";

import { EMPTY_DUE, formatDue, setDueDate, setDueTime, withToday } from "./due-date";

const at = (day: number, hour = 14, minute = 30) => new Date(2026, 10, day, hour, minute, 0, 0);

describe("formatDue", () => {
  it("is empty without a date", () => {
    expect(formatDue(EMPTY_DUE)).toBeNull();
  });

  it("hides the time for a date-only value", () => {
    expect(formatDue({ at: new Date(2026, 10, 20, 23, 59, 59, 999), hasTime: false })).toBe(
      "20/11/2026",
    );
  });

  it("shows the time when it is part of the deadline", () => {
    expect(formatDue({ at: at(20), hasTime: true })).toBe("20/11/2026 14:30");
  });
});

describe("setDueDate", () => {
  it("moves a date-only deadline to the end of the selected day", () => {
    const result = setDueDate(EMPTY_DUE, at(25));

    expect(result.hasTime).toBe(false);
    expect(result.at).not.toBeNull();
    expect(result.at?.getDate()).toBe(25);
    expect(result.at?.getHours()).toBe(23);
    expect(result.at?.getMinutes()).toBe(59);
    expect(result.at?.getSeconds()).toBe(59);
    expect(result.at?.getMilliseconds()).toBe(999);
  });

  it("keeps the existing time when the deadline has one", () => {
    const result = setDueDate({ at: at(20), hasTime: true }, at(25, 0, 0));

    expect(result.hasTime).toBe(true);
    expect(result.at?.getDate()).toBe(25);
    expect(result.at?.getHours()).toBe(14);
    expect(result.at?.getMinutes()).toBe(30);
  });

  it("starts at 09:00 when time is enabled without a previous date", () => {
    const result = setDueDate({ at: null, hasTime: true }, at(25, 0, 0));

    expect(result.at?.getHours()).toBe(9);
    expect(result.at?.getMinutes()).toBe(0);
  });

  it("clears the value when the date is removed", () => {
    expect(setDueDate({ at: at(20), hasTime: true }, null)).toEqual(EMPTY_DUE);
  });
});

describe("setDueTime", () => {
  it("switches to 09:00 when time is enabled", () => {
    const result = setDueTime({ at: at(20), hasTime: false }, true);

    expect(result).toMatchObject({ hasTime: true });
    expect(result.at?.getHours()).toBe(9);
    expect(result.at?.getMinutes()).toBe(0);
  });

  it("moves to the end of the day when time is disabled", () => {
    const result = setDueTime({ at: at(20), hasTime: true }, false);

    expect(result.hasTime).toBe(false);
    expect(result.at?.getHours()).toBe(23);
    expect(result.at?.getMinutes()).toBe(59);
    expect(result.at?.getMilliseconds()).toBe(999);
  });

  it("does nothing without a date", () => {
    expect(setDueTime(EMPTY_DUE, true)).toEqual(EMPTY_DUE);
  });
});

describe("withToday", () => {
  const now = new Date(2026, 10, 13, 16, 0, 0, 0);

  it("keeps the date-only mode and uses the end of today", () => {
    const result = withToday(EMPTY_DUE, now);

    expect(result.hasTime).toBe(false);
    expect(result.at?.getDate()).toBe(13);
    expect(result.at?.getHours()).toBe(23);
  });

  it("keeps the time when the deadline has one", () => {
    const result = withToday({ at: at(20), hasTime: true }, now);

    expect(result.hasTime).toBe(true);
    expect(result.at?.getDate()).toBe(13);
    expect(result.at?.getHours()).toBe(14);
    expect(result.at?.getMinutes()).toBe(30);
  });
});

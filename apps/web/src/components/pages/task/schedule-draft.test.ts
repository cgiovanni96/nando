import { describe, expect, it } from "vitest";

import {
  EMPTY_DRAFT,
  draftFromSchedule,
  draftViolation,
  formatDraft,
  isLate,
  scheduleFromDraft,
  setDraftDates,
  setDraftRange,
  setDraftTime,
  type ScheduleDraft,
} from "./schedule-draft";

const ROME = "Europe/Rome";

describe("draftFromSchedule / scheduleFromDraft", () => {
  it("round-trips an all-day range as local dates", () => {
    const draft = draftFromSchedule(
      { allDay: true, from: "2026-10-27", to: "2026-10-29", timeZone: ROME },
      ROME,
    );

    expect(draft).toEqual({
      includeTime: false,
      range: true,
      start: { date: "2026-10-27", time: "09:00" },
      end: { date: "2026-10-29", time: "09:00" },
    });
    expect(scheduleFromDraft(draft, ROME)).toEqual({
      allDay: true,
      from: "2026-10-27",
      to: "2026-10-29",
    });
  });

  it("reads and writes a timed deadline in the task time zone, not the browser's", () => {
    // 18:00 UTC = 19:00 a Roma (CET).
    const draft = draftFromSchedule(
      { allDay: false, from: null, to: "2026-11-12T18:00:00.000Z", timeZone: ROME },
      ROME,
    );

    expect(draft.end).toEqual({ date: "2026-11-12", time: "19:00" });
    expect(scheduleFromDraft(draft, ROME)).toEqual({
      allDay: false,
      from: null,
      to: "2026-11-12T18:00:00.000Z",
    });
  });

  it("handles the end of daylight saving time (25/10/2026)", () => {
    const draft: ScheduleDraft = {
      includeTime: true,
      range: true,
      start: { date: "2026-10-24", time: "10:00" },
      end: { date: "2026-10-26", time: "10:00" },
    };

    expect(scheduleFromDraft(draft, ROME)).toEqual({
      allDay: false,
      from: "2026-10-24T08:00:00.000Z", // CEST, +2
      to: "2026-10-26T09:00:00.000Z", // CET, +1
    });
  });

  it("maps an empty draft to no Schedule", () => {
    expect(draftFromSchedule(null, ROME)).toEqual(EMPTY_DRAFT);
    expect(scheduleFromDraft(EMPTY_DRAFT, ROME)).toBeNull();
  });
});

describe("editing", () => {
  it("picks a single day and keeps the current mode", () => {
    const draft = setDraftDates(EMPTY_DRAFT, ["2026-11-20", null]);
    expect(draft.end).toEqual({ date: "2026-11-20", time: "09:00" });
    expect(draft.start).toBeNull();
  });

  it("turns a deadline into a range starting on the same day, and back", () => {
    const point = setDraftDates(EMPTY_DRAFT, ["2026-11-20", null]);
    const range = setDraftRange(point, true);
    expect(range.start).toEqual({ date: "2026-11-20", time: "09:00" });

    const back = setDraftRange(range, false);
    expect(back.start).toBeNull();
    expect(back.end).toEqual(point.end);
  });

  it("sets the time of start or end", () => {
    const range = setDraftRange(setDraftDates(EMPTY_DRAFT, ["2026-11-20", null]), true);
    const timed = setDraftTime({ ...range, includeTime: true }, "end", "18:30");
    expect(timed.end?.time).toBe("18:30");
  });
});

describe("draftViolation and formatDraft", () => {
  it("flags a range that ends before it starts", () => {
    expect(
      draftViolation({
        includeTime: true,
        range: true,
        start: { date: "2026-11-20", time: "10:00" },
        end: { date: "2026-11-20", time: "09:00" },
      }),
    ).toBe("endBeforeStart");
    expect(draftViolation(EMPTY_DRAFT)).toBeNull();
  });

  it("formats points and ranges", () => {
    expect(formatDraft(EMPTY_DRAFT)).toBeNull();
    expect(
      formatDraft({
        includeTime: false,
        range: false,
        start: null,
        end: { date: "2026-11-20", time: "09:00" },
      }),
    ).toBe("20/11/2026");
    expect(
      formatDraft({
        includeTime: true,
        range: true,
        start: { date: "2026-11-20", time: "10:00" },
        end: { date: "2026-11-20", time: "11:30" },
      }),
    ).toBe("20/11/2026 10:00 → 11:30");
  });
});

describe("isLate", () => {
  it("an all-day deadline is late from the next local day", () => {
    const schedule = { allDay: true as const, from: null, to: "2026-10-27", timeZone: ROME };
    expect(isLate(schedule, "open", new Date("2026-10-27T22:59:00Z"))).toBe(false);
    expect(isLate(schedule, "open", new Date("2026-10-27T23:00:00Z"))).toBe(true);
    expect(isLate(schedule, "completed", new Date("2026-11-27T23:00:00Z"))).toBe(false);
  });

  it("a timed deadline is late right after it passes", () => {
    const schedule = {
      allDay: false as const,
      from: null,
      to: "2026-10-28T07:00:00.000Z",
      timeZone: ROME,
    };
    expect(isLate(schedule, "open", new Date("2026-10-28T07:01:00Z"))).toBe(true);
  });
});

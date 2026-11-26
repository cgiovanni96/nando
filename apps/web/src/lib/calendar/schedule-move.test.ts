import { describe, expect, it } from "vitest";

import type { AgendaItem } from "@web/lib/queries/agenda";

import { moveSchedule, planSchedule, resizeSchedule } from "./schedule-move";

const TIME_ZONE = "Europe/Rome";
const OTHER_TIME_ZONE = "America/New_York";

function allDay(from: string | null, to: string, timeZone = TIME_ZONE): AgendaItem["schedule"] {
  return { allDay: true, from, to, timeZone };
}

function timed(from: string | null, to: string, timeZone = TIME_ZONE): AgendaItem["schedule"] {
  return { allDay: false, from, to, timeZone };
}

describe("moveSchedule", () => {
  it("moves an all-day range by two days and keeps its length", () => {
    const result = moveSchedule(allDay("2026-11-23", "2026-11-25"), {
      shownStart: "2026-11-23 00:00:00",
      newStart: "2026-11-25 00:00:00",
      grabbedDay: null,
    });

    expect(result).toEqual({ allDay: true, from: "2026-11-25", to: "2026-11-27" });
  });

  it("subtracts the day the range was grabbed on", () => {
    const result = moveSchedule(allDay("2026-11-23", "2026-11-25"), {
      shownStart: "2026-11-23 00:00:00",
      newStart: "2026-11-26 00:00:00",
      grabbedDay: "2026-11-24",
    });

    expect(result).toEqual({ allDay: true, from: "2026-11-25", to: "2026-11-27" });
  });

  it("moves an all-day range that starts before the week by the covered days", () => {
    const result = moveSchedule(allDay("2026-11-20", "2026-11-24"), {
      shownStart: "2026-11-23 00:00:00",
      newStart: "2026-11-26 00:00:00",
      grabbedDay: null,
    });

    expect(result).toEqual({ allDay: true, from: "2026-11-23", to: "2026-11-27" });
  });

  it("moves an all-day point across a month end and keeps it a point", () => {
    const result = moveSchedule(allDay(null, "2026-11-30"), {
      shownStart: "2026-11-30 00:00:00",
      newStart: "2026-12-02 00:00:00",
      grabbedDay: null,
    });

    expect(result).toEqual({ allDay: true, from: null, to: "2026-12-02" });
  });

  it("moves an all-day range across a month end", () => {
    const result = moveSchedule(allDay("2026-11-29", "2026-11-30"), {
      shownStart: "2026-11-29 00:00:00",
      newStart: "2026-12-01 00:00:00",
      grabbedDay: null,
    });

    expect(result).toEqual({ allDay: true, from: "2026-12-01", to: "2026-12-02" });
  });

  it("moves a timed range to another day and hour, keeping its duration", () => {
    const result = moveSchedule(timed("2026-11-25T09:00:00.000Z", "2026-11-25T11:00:00.000Z"), {
      shownStart: "2026-11-25 10:00:00",
      newStart: "2026-11-26 14:30:00",
      grabbedDay: null,
    });

    expect(result).toEqual({
      allDay: false,
      from: "2026-11-26T13:30:00.000Z",
      to: "2026-11-26T15:30:00.000Z",
    });
  });

  it("moves a timed point keeping from null", () => {
    const result = moveSchedule(timed(null, "2026-11-25T09:00:00.000Z"), {
      shownStart: "2026-11-25 10:00:00",
      newStart: "2026-11-25 11:00:00",
      grabbedDay: null,
    });

    expect(result).toEqual({ allDay: false, from: null, to: "2026-11-25T10:00:00.000Z" });
  });

  it("moves a multi-day range widened to 00:00 by whole days and keeps its hour", () => {
    const result = moveSchedule(timed("2026-11-23T21:00:00.000Z", "2026-11-26T01:00:00.000Z"), {
      shownStart: "2026-11-23 00:00:00",
      newStart: "2026-11-26 00:00:00",
      grabbedDay: null,
    });

    expect(result).toEqual({
      allDay: false,
      from: "2026-11-26T21:00:00.000Z",
      to: "2026-11-29T01:00:00.000Z",
    });
  });

  it("moves a range clipped to 00:00 by the five hours of the drop", () => {
    const result = moveSchedule(timed("2026-11-24T21:00:00.000Z", "2026-11-25T11:00:00.000Z"), {
      shownStart: "2026-11-25 00:00:00",
      newStart: "2026-11-25 05:00:00",
      grabbedDay: null,
    });

    expect(result).toEqual({
      allDay: false,
      from: "2026-11-25T02:00:00.000Z",
      to: "2026-11-25T16:00:00.000Z",
    });
  });

  it("reads and writes the wall clock of the task timezone, not the browser's", () => {
    const result = moveSchedule(
      timed("2026-11-25T15:00:00.000Z", "2026-11-25T17:30:00.000Z", OTHER_TIME_ZONE),
      {
        shownStart: "2026-11-25 10:00:00",
        newStart: "2026-11-26 15:00:00",
        grabbedDay: null,
      },
    );

    expect(result).toEqual({
      allDay: false,
      from: "2026-11-26T20:00:00.000Z",
      to: "2026-11-26T22:30:00.000Z",
    });
  });

  it("keeps 10:00 local and two real hours across 2027-03-28 in Rome", () => {
    const result = moveSchedule(timed("2027-03-27T09:00:00.000Z", "2027-03-27T11:00:00.000Z"), {
      shownStart: "2027-03-27 10:00:00",
      newStart: "2027-03-28 10:00:00",
      grabbedDay: null,
    });

    expect(result).toEqual({
      allDay: false,
      from: "2027-03-28T08:00:00.000Z",
      to: "2027-03-28T10:00:00.000Z",
    });
  });

  it("keeps 10:00 local and two real hours across 2026-10-25 in Rome", () => {
    const result = moveSchedule(timed("2026-10-24T08:00:00.000Z", "2026-10-24T10:00:00.000Z"), {
      shownStart: "2026-10-24 10:00:00",
      newStart: "2026-10-25 10:00:00",
      grabbedDay: null,
    });

    expect(result).toEqual({
      allDay: false,
      from: "2026-10-25T09:00:00.000Z",
      to: "2026-10-25T11:00:00.000Z",
    });
  });

  it("turns a drop on the missing hour of 2027-03-28 02:30 into 03:30 local", () => {
    const result = moveSchedule(timed("2027-03-27T09:00:00.000Z", "2027-03-27T11:00:00.000Z"), {
      shownStart: "2027-03-27 10:00:00",
      newStart: "2027-03-28 02:30:00",
      grabbedDay: null,
    });

    expect(result).toEqual({
      allDay: false,
      from: "2027-03-28T01:30:00.000Z",
      to: "2027-03-28T03:30:00.000Z",
    });
  });

  it("takes the second 02:30 of 2026-10-25 in Rome", () => {
    const result = moveSchedule(timed("2027-03-27T09:00:00.000Z", "2027-03-27T11:00:00.000Z"), {
      shownStart: "2027-03-27 10:00:00",
      newStart: "2026-10-25 02:30:00",
      grabbedDay: null,
    });

    expect(result).toEqual({
      allDay: false,
      from: "2026-10-25T01:30:00.000Z",
      to: "2026-10-25T03:30:00.000Z",
    });
  });

  it("keeps the real duration of an overnight range moved onto 2027-03-27 23:00", () => {
    const result = moveSchedule(timed("2026-11-25T21:00:00.000Z", "2026-11-26T02:00:00.000Z"), {
      shownStart: "2026-11-25 22:00:00",
      newStart: "2027-03-27 23:00:00",
      grabbedDay: null,
    });

    expect(result).toEqual({
      allDay: false,
      from: "2027-03-27T22:00:00.000Z",
      to: "2027-03-28T03:00:00.000Z",
    });
  });

  it("returns null for a zero shift", () => {
    expect(
      moveSchedule(timed("2026-11-25T09:00:00.000Z", "2026-11-25T11:00:00.000Z"), {
        shownStart: "2026-11-25 10:00:00",
        newStart: "2026-11-25 10:00:00",
        grabbedDay: null,
      }),
    ).toBeNull();
    expect(
      moveSchedule(allDay("2026-11-23", "2026-11-25"), {
        shownStart: "2026-11-23 00:00:00",
        newStart: "2026-11-23 00:00:00",
        grabbedDay: null,
      }),
    ).toBeNull();
  });

  it("returns null when the missing hour leaves the instants unchanged", () => {
    const result = moveSchedule(timed("2027-03-28T01:30:00.000Z", "2027-03-28T03:30:00.000Z"), {
      shownStart: "2027-03-28 03:30:00",
      newStart: "2027-03-28 02:30:00",
      grabbedDay: null,
    });

    expect(result).toBeNull();
  });
});

describe("resizeSchedule", () => {
  const range = timed("2026-11-25T09:00:00.000Z", "2026-11-25T11:00:00.000Z");

  it("recomputes only the start and keeps the end instant", () => {
    const result = resizeSchedule(range, {
      shownStart: "2026-11-25 10:00:00",
      shownEnd: "2026-11-25 12:00:00",
      newStart: "2026-11-25 09:30:00",
      newEnd: "2026-11-25 12:00:00",
    });

    expect(result).toEqual({
      allDay: false,
      from: "2026-11-25T08:30:00.000Z",
      to: "2026-11-25T11:00:00.000Z",
    });
  });

  it("recomputes the end across the change of 2027-03-28 in Rome", () => {
    const result = resizeSchedule(timed("2027-03-27T22:00:00.000Z", "2027-03-28T01:00:00.000Z"), {
      shownStart: "2027-03-27 23:00:00",
      shownEnd: "2027-03-28 03:00:00",
      newStart: "2027-03-27 23:00:00",
      newEnd: "2027-03-28 04:00:00",
    });

    expect(result).toEqual({
      allDay: false,
      from: "2027-03-27T22:00:00.000Z",
      to: "2027-03-28T02:00:00.000Z",
    });
  });

  it("takes the absolute instant of the shown start when the range began yesterday", () => {
    const result = resizeSchedule(timed("2026-11-24T21:00:00.000Z", "2026-11-25T11:00:00.000Z"), {
      shownStart: "2026-11-25 00:00:00",
      shownEnd: "2026-11-25 12:00:00",
      newStart: "2026-11-25 01:00:00",
      newEnd: "2026-11-25 12:00:00",
    });

    expect(result).toEqual({
      allDay: false,
      from: "2026-11-25T00:00:00.000Z",
      to: "2026-11-25T11:00:00.000Z",
    });
  });

  it("takes the absolute instant of the shown end when the range ends tomorrow", () => {
    const result = resizeSchedule(timed("2026-11-25T11:00:00.000Z", "2026-11-26T07:00:00.000Z"), {
      shownStart: "2026-11-25 12:00:00",
      shownEnd: "2026-11-26 00:00:00",
      newStart: "2026-11-25 12:00:00",
      newEnd: "2026-11-25 22:00:00",
    });

    expect(result).toEqual({
      allDay: false,
      from: "2026-11-25T11:00:00.000Z",
      to: "2026-11-25T21:00:00.000Z",
    });
  });

  it("returns null for a point", () => {
    expect(
      resizeSchedule(timed(null, "2026-11-25T09:00:00.000Z"), {
        shownStart: "2026-11-25 10:00:00",
        shownEnd: "2026-11-25 10:30:00",
        newStart: "2026-11-25 10:00:00",
        newEnd: "2026-11-25 11:00:00",
      }),
    ).toBeNull();
  });

  it("returns null for an all-day schedule", () => {
    expect(
      resizeSchedule(allDay("2026-11-23", "2026-11-25"), {
        shownStart: "2026-11-23 00:00:00",
        shownEnd: "2026-11-26 00:00:00",
        newStart: "2026-11-23 00:00:00",
        newEnd: "2026-11-27 00:00:00",
      }),
    ).toBeNull();
  });

  it("returns null when nothing changed", () => {
    expect(
      resizeSchedule(range, {
        shownStart: "2026-11-25 10:00:00",
        shownEnd: "2026-11-25 12:00:00",
        newStart: "2026-11-25 10:00:00",
        newEnd: "2026-11-25 12:00:00",
      }),
    ).toBeNull();
  });

  it("returns null when the edges cross", () => {
    expect(
      resizeSchedule(range, {
        shownStart: "2026-11-25 10:00:00",
        shownEnd: "2026-11-25 12:00:00",
        newStart: "2026-11-25 13:00:00",
        newEnd: "2026-11-25 12:00:00",
      }),
    ).toBeNull();
    expect(
      resizeSchedule(range, {
        shownStart: "2026-11-25 10:00:00",
        shownEnd: "2026-11-25 12:00:00",
        newStart: "2026-11-25 12:00:00",
        newEnd: "2026-11-25 12:00:00",
      }),
    ).toBeNull();
  });
});

describe("planSchedule", () => {
  it("plans a whole day from a drop on a day", () => {
    expect(planSchedule({ dateTime: "2026-11-25 00:00:00", allDay: true }, TIME_ZONE)).toEqual({
      allDay: true,
      from: null,
      to: "2026-11-25",
    });
  });

  it("plans a point from a drop on a slot", () => {
    const result = planSchedule({ dateTime: "2026-11-25 09:30:00", allDay: false }, TIME_ZONE);

    expect(result).toEqual({ allDay: false, from: null, to: "2026-11-25T08:30:00.000Z" });
    expect(Object.keys(result).toSorted()).toEqual(["allDay", "from", "to"]);
  });

  it("plans the 00:00 slot as the start of the local day", () => {
    expect(planSchedule({ dateTime: "2026-11-25 00:00:00", allDay: false }, TIME_ZONE)).toEqual({
      allDay: false,
      from: null,
      to: "2026-11-24T23:00:00.000Z",
    });
  });
});

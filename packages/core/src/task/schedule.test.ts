import { describe, expect, it } from "vitest";

import {
  buildSchedule,
  isValidTimeZone,
  localDate,
  scheduleDueDate,
  scheduleStartDate,
  temporalState,
  type Schedule,
} from "./schedule";

const ROME = "Europe/Rome";

function allDay(to: string, from: string | null = null): Schedule {
  return { allDay: true, from, to, timeZone: ROME };
}

function timed(to: string, from: string | null = null): Schedule {
  return { allDay: false, from: from ? new Date(from) : null, to: new Date(to), timeZone: ROME };
}

describe("isValidTimeZone", () => {
  it("accetta un nome IANA e rifiuta il resto", () => {
    expect(isValidTimeZone("Europe/Rome")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
    expect(isValidTimeZone("Europa/Roma")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
  });
});

describe("localDate", () => {
  it("restituisce il giorno nella timezone data, non in UTC", () => {
    // 23:30 UTC del 27/10 è già il 28/10 a Roma (CET, +1).
    expect(localDate(new Date("2026-10-27T23:30:00Z"), ROME)).toBe("2026-10-28");
    expect(localDate(new Date("2026-10-27T23:30:00Z"), "UTC")).toBe("2026-10-27");
  });

  it("regge il passaggio all'ora solare (25/10/2026, 03:00 → 02:00)", () => {
    expect(localDate(new Date("2026-10-24T22:30:00Z"), ROME)).toBe("2026-10-25"); // 00:30 CEST
    expect(localDate(new Date("2026-10-25T22:30:00Z"), ROME)).toBe("2026-10-25"); // 23:30 CET
  });

  it("regge il passaggio all'ora legale (29/03/2026, 02:00 → 03:00)", () => {
    expect(localDate(new Date("2026-03-28T23:30:00Z"), ROME)).toBe("2026-03-29"); // 00:30 CET
    expect(localDate(new Date("2026-03-29T21:30:00Z"), ROME)).toBe("2026-03-29"); // 23:30 CEST
  });
});

describe("scheduleDueDate", () => {
  it("per un all-day è il giorno di scadenza, senza conversioni", () => {
    expect(scheduleDueDate(allDay("2026-10-29", "2026-10-27"))).toBe("2026-10-29");
  });

  it("per un timed è il giorno locale dell'istante: il confine dipende dalla timezone", () => {
    // 23:30 UTC del 23/11 è già il 24/11 a Roma (CET, +1).
    expect(scheduleDueDate(timed("2026-11-23T23:30:00.000Z"))).toBe("2026-11-24");
    expect(
      scheduleDueDate({
        allDay: false,
        from: null,
        to: new Date("2026-11-23T23:30:00.000Z"),
        timeZone: "UTC",
      }),
    ).toBe("2026-11-23");
  });
});

describe("scheduleStartDate", () => {
  it("per un all-day è il giorno d'inizio dell'intervallo", () => {
    expect(scheduleStartDate(allDay("2026-10-29", "2026-10-27"))).toBe("2026-10-27");
  });

  it("è null per un punto senza from", () => {
    expect(scheduleStartDate(allDay("2026-10-27"))).toBeNull();
    expect(scheduleStartDate(timed("2026-10-27T10:00:00.000Z"))).toBeNull();
  });

  it("per un timed è il giorno locale del from, anche se cade nel giorno prima", () => {
    const schedule = timed("2026-11-24T09:00:00.000Z", "2026-11-23T22:30:00.000Z");
    expect(scheduleStartDate(schedule)).toBe("2026-11-23");
    expect(scheduleDueDate(schedule)).toBe("2026-11-24");
  });
});

describe("buildSchedule", () => {
  it("costruisce un punto all-day", () => {
    const result = buildSchedule({ allDay: true, from: null, to: "2026-10-27" }, ROME);
    expect(result).toEqual({ ok: true, value: allDay("2026-10-27") });
  });

  it("costruisce un intervallo timed", () => {
    const result = buildSchedule(
      { allDay: false, from: "2026-10-27T09:00:00.000Z", to: "2026-10-27T10:30:00.000Z" },
      ROME,
    );
    expect(result).toEqual({
      ok: true,
      value: timed("2026-10-27T10:30:00.000Z", "2026-10-27T09:00:00.000Z"),
    });
  });

  it("rifiuta from dopo to", () => {
    const allDayResult = buildSchedule(
      { allDay: true, from: "2026-10-28", to: "2026-10-27" },
      ROME,
    );
    const timedResult = buildSchedule(
      { allDay: false, from: "2026-10-27T11:00:00.000Z", to: "2026-10-27T10:00:00.000Z" },
      ROME,
    );
    expect(allDayResult.ok).toBe(false);
    expect(timedResult.ok).toBe(false);
  });

  it("rifiuta tipi mescolati: date locali per un timed, istanti per un all-day", () => {
    expect(buildSchedule({ allDay: false, from: null, to: "2026-10-27" }, ROME).ok).toBe(false);
    expect(
      buildSchedule({ allDay: true, from: null, to: "2026-10-27T10:00:00.000Z" }, ROME).ok,
    ).toBe(false);
  });

  it("rifiuta date inesistenti e timezone non valide", () => {
    expect(buildSchedule({ allDay: true, from: null, to: "2026-02-30" }, ROME).ok).toBe(false);
    expect(buildSchedule({ allDay: true, from: null, to: "2026-10-27" }, "Mars/Base").ok).toBe(
      false,
    );
  });
});

describe("temporalState", () => {
  it("non deriva nulla per un'occorrenza chiusa", () => {
    expect(temporalState(allDay("2026-10-20"), "completed", new Date("2026-10-28T09:00:00Z"))).toBe(
      null,
    );
  });

  it("un all-day del 27/10 è overdue dal 28/10 00:00 a Roma, non prima", () => {
    const schedule = allDay("2026-10-27");
    // 27/10 23:59 a Roma = 22:59 UTC
    expect(temporalState(schedule, "open", new Date("2026-10-27T22:59:00Z"))).toBe("upcoming");
    // 28/10 00:00 a Roma = 23:00 UTC del 27/10
    expect(temporalState(schedule, "open", new Date("2026-10-27T23:00:00Z"))).toBe("overdue");
  });

  it("un range all-day è current mentre comprende oggi", () => {
    const schedule = allDay("2026-10-29", "2026-10-27");
    expect(temporalState(schedule, "open", new Date("2026-10-26T12:00:00Z"))).toBe("upcoming");
    expect(temporalState(schedule, "open", new Date("2026-10-28T12:00:00Z"))).toBe("current");
    expect(temporalState(schedule, "open", new Date("2026-10-29T21:00:00Z"))).toBe("current");
    expect(temporalState(schedule, "open", new Date("2026-10-29T23:30:00Z"))).toBe("overdue");
  });

  it("un timed è overdue appena passa to; un intervallo è current tra from e to", () => {
    const point = timed("2026-10-28T07:00:00Z");
    expect(temporalState(point, "open", new Date("2026-10-28T06:59:00Z"))).toBe("upcoming");
    expect(temporalState(point, "open", new Date("2026-10-28T07:01:00Z"))).toBe("overdue");

    const block = timed("2026-10-28T15:45:00Z", "2026-10-28T15:00:00Z");
    expect(temporalState(block, "open", new Date("2026-10-28T15:10:00Z"))).toBe("current");
  });

  it("nei giorni del cambio d'ora un all-day scade alla mezzanotte locale giusta", () => {
    // 25/10/2026: la giornata dura 25 ore; mezzanotte del 26 a Roma = 23:00 UTC del 25.
    const autumn = allDay("2026-10-25");
    expect(temporalState(autumn, "open", new Date("2026-10-25T22:59:00Z"))).toBe("upcoming");
    expect(temporalState(autumn, "open", new Date("2026-10-25T23:00:00Z"))).toBe("overdue");

    // 29/03/2026: la giornata dura 23 ore; mezzanotte del 30 a Roma = 22:00 UTC del 29.
    const spring = allDay("2026-03-29");
    expect(temporalState(spring, "open", new Date("2026-03-29T21:59:00Z"))).toBe("upcoming");
    expect(temporalState(spring, "open", new Date("2026-03-29T22:00:00Z"))).toBe("overdue");
  });

  it("vale anche per un'occorrenza in corso (ADR-0028)", () => {
    expect(
      temporalState(allDay("2026-10-20"), "in_progress", new Date("2026-10-28T09:00:00Z")),
    ).toBe("overdue");
  });
});

import { describe, expect, it } from "vitest";

import { formatLocalDate } from "@web/lib/format/datetime";

import { periodLabel } from "./period-label";

describe("periodLabel", () => {
  it("names the month and its year", () => {
    expect(periodLabel("month", "2026-11-25")).toBe("novembre 2026");
  });

  it("uses the long local date for a day", () => {
    expect(periodLabel("day", "2026-11-25")).toBe(formatLocalDate("2026-11-25", "long"));
    expect(periodLabel("day", "2026-11-25")).toBe("mercoledì 25 novembre");
  });

  it("writes the week as a short range with the year once", () => {
    expect(periodLabel("week", "2026-11-25")).toBe("23 nov – 29 nov 2026");
  });

  it("writes the agenda as a short range with the year once", () => {
    expect(periodLabel("agenda", "2026-11-25")).toBe("25 nov – 8 dic 2026");
  });

  it("keeps both years when the range crosses the year", () => {
    expect(periodLabel("week", "2026-12-31")).toBe("28 dic 2026 – 3 gen 2027");
  });
});

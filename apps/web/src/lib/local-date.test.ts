import { describe, expect, it } from "vitest";

import { addDays, localToday } from "./local-date";

describe("addDays", () => {
  it("crosses month and year boundaries", () => {
    expect(addDays("2026-11-28", 4)).toBe("2026-12-02");
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("localToday", () => {
  it("formats the browser's local calendar day with zero padding", () => {
    expect(localToday(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
  });
});

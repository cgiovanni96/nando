import { describe, expect, it } from "vitest";

import { fixedClock, systemClock } from "./clock";

describe("Clock", () => {
  it("reads the current time", () => {
    const before = Date.now();
    const now = systemClock.now().getTime();
    const after = Date.now();

    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(after);
  });

  it("returns independent dates from a fixed clock", () => {
    const clock = fixedClock("2026-11-09T10:00:00.000Z");
    const first = clock.now();
    first.setUTCFullYear(2000);

    expect(clock.now().toISOString()).toBe("2026-11-09T10:00:00.000Z");
  });
});

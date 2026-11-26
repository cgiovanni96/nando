import { describe, expect, it } from "vitest";

import { columnDay } from "./grabbed-day";

const WEEK = { left: 0, width: 700, from: "2026-11-23" };

describe("columnDay", () => {
  it("maps the first column", () => {
    expect(columnDay({ pointer: 50, ...WEEK })).toBe("2026-11-23");
  });

  it("maps a middle column", () => {
    expect(columnDay({ pointer: 350, ...WEEK })).toBe("2026-11-26");
  });

  it("maps the last column", () => {
    expect(columnDay({ pointer: 650, ...WEEK })).toBe("2026-11-29");
  });

  it("keeps the left edge in the first column", () => {
    expect(columnDay({ pointer: 0, ...WEEK })).toBe("2026-11-23");
  });

  it("clamps a pointer left of the week", () => {
    expect(columnDay({ pointer: -20, ...WEEK })).toBe("2026-11-23");
  });

  it("clamps a pointer right of the week", () => {
    expect(columnDay({ pointer: 720, ...WEEK })).toBe("2026-11-29");
  });
});

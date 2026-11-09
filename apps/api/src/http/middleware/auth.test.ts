import { describe, expect, it } from "vitest";

import { internalTokenMatches } from "./auth";

const token = "0123456789abcdef";

describe("internalTokenMatches", () => {
  it("accepts the exact bearer token", () => {
    expect(internalTokenMatches(`Bearer ${token}`, token)).toBe(true);
  });

  it("rejects a missing header", () => {
    expect(internalTokenMatches(undefined, token)).toBe(false);
  });

  it("rejects a different token", () => {
    expect(internalTokenMatches("Bearer 0123456789abcdee", token)).toBe(false);
  });

  it("rejects a different scheme", () => {
    expect(internalTokenMatches(`Basic ${token}`, token)).toBe(false);
  });
});

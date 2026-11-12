import { test } from "@fast-check/vitest";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { newId } from "./ids";

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("newId", () => {
  it("returns a UUIDv7", () => {
    const id = newId();
    expect(id).toMatch(UUID_V7);
  });

  it("orders ids by creation time", () => {
    const first = newId();
    const second = newId();
    expect(first < second).toBe(true);
  });

  test.prop([fc.integer({ min: 1, max: 200 })])("generates unique ids", (count) => {
    const ids = Array.from({ length: count }, () => newId());

    expect(new Set(ids).size).toBe(ids.length);
  });

  test.prop([fc.integer({ min: 1, max: 50 })])("every id is a UUIDv7", (count) => {
    for (const id of Array.from({ length: count }, () => newId())) {
      expect(id).toMatch(UUID_V7);
    }
  });
});

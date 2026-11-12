import { test } from "@fast-check/vitest";
import fc from "fast-check";
import { describe, expect } from "vitest";

import {
  clampLimit,
  decodeCursor,
  decodeIdCursor,
  DEFAULT_PAGE_SIZE,
  encodeCursor,
  MAX_PAGE_SIZE,
} from "./cursor";

const cursorValue = fc.dictionary(
  fc.stringMatching(/^[a-z0-9_-]{0,12}$/),
  fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.constant(null)),
);

describe("cursor", () => {
  test.prop([cursorValue])("encode/decode roundtrips plain objects", (value) => {
    expect(decodeCursor(encodeCursor(value))).toEqual(value);
  });

  test.prop([fc.uuid()])("decodeIdCursor reads a valid id cursor", (id) => {
    expect(decodeIdCursor(encodeCursor({ id }))).toBe(id);
  });

  test.prop([fc.string()])("decodeCursor never throws", (value) => {
    expect(() => decodeCursor(value)).not.toThrow();
  });

  test.prop([fc.oneof(fc.constant(""), fc.constant("not-a-uuid"), fc.string({ maxLength: 8 }))])(
    "decodeIdCursor ignores a non-uuid id",
    (id) => {
      expect(decodeIdCursor(encodeCursor({ id }))).toBeNull();
    },
  );
});

describe("clampLimit", () => {
  test.prop([fc.oneof(fc.integer(), fc.constant(undefined))])(
    "stays within bounds and is idempotent",
    (limit) => {
      const clamped = clampLimit(limit);

      expect(clamped).toBeGreaterThanOrEqual(1);
      expect(clamped).toBeLessThanOrEqual(MAX_PAGE_SIZE);
      expect(clampLimit(clamped)).toBe(clamped);
    },
  );

  test.prop([fc.integer({ min: 1, max: MAX_PAGE_SIZE })])(
    "leaves a valid limit unchanged",
    (limit) => {
      expect(clampLimit(limit)).toBe(limit);
    },
  );

  test("defaults a missing or NaN limit", () => {
    expect(clampLimit(undefined)).toBe(DEFAULT_PAGE_SIZE);
    expect(clampLimit(Number.NaN)).toBe(DEFAULT_PAGE_SIZE);
  });
});

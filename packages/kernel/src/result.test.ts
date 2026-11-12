import { test } from "@fast-check/vitest";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { err, flatMapResult, mapResult, ok, unwrapOr } from "./result";

describe("Result", () => {
  it("maps a success value", () => {
    expect(mapResult(ok(2), (value) => value * 3)).toEqual(ok(6));
  });

  it("keeps an error unchanged through map", () => {
    const failure = err({ code: "boom", message: "Boom" });
    expect(mapResult(failure, (value: number) => value * 3)).toEqual(failure);
  });

  it("chains a success into another result", () => {
    expect(flatMapResult(ok(2), (value) => ok(value + 1))).toEqual(ok(3));
  });

  it("returns the fallback only for an error", () => {
    expect(unwrapOr(ok("value"), "fallback")).toBe("value");
    expect(unwrapOr(err({ code: "boom", message: "Boom" }), "fallback")).toBe("fallback");
  });
});

const increment = (value: number) => value + 1;
const double = (value: number) => value * 2;

describe("Result (properties)", () => {
  test.prop([fc.integer()])("map with identity is a no-op", (value) => {
    expect(mapResult(ok(value), (inner) => inner)).toEqual(ok(value));
  });

  test.prop([fc.integer()])("map composes", (value) => {
    expect(mapResult(mapResult(ok(value), increment), double)).toEqual(
      mapResult(ok(value), (inner) => double(increment(inner))),
    );
  });

  test.prop([fc.integer(), fc.integer()])("flatMap keeps the error unchanged", (value, offset) => {
    const failure = err({ code: "boom", message: "Boom" });

    expect(flatMapResult(failure, (inner: number) => ok(inner + offset))).toEqual(failure);
  });

  test.prop([fc.integer(), fc.integer()])(
    "unwrapOr prefers the value and falls back on error",
    (value, fallback) => {
      expect(unwrapOr(ok(value), fallback)).toBe(value);
      expect(unwrapOr(err({ code: "boom", message: "Boom" }), fallback)).toBe(fallback);
    },
  );
});

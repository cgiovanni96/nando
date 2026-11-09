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

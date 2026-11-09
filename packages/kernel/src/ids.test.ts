import { describe, expect, it } from "vitest";

import { newId } from "./ids";

describe("newId", () => {
  it("returns a UUIDv7", () => {
    const id = newId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("orders ids by creation time", () => {
    const first = newId();
    const second = newId();
    expect(first < second).toBe(true);
  });
});

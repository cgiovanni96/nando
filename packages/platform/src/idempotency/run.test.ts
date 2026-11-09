import { describe, expect, it } from "vitest";

import { hashPayload } from "./run";

describe("hashPayload", () => {
  it("is stable for equal payloads", () => {
    expect(hashPayload({ message: "Ciao" })).toBe(hashPayload({ message: "Ciao" }));
  });

  it("changes when the payload changes", () => {
    expect(hashPayload({ message: "Ciao" })).not.toBe(hashPayload({ message: "Altro" }));
  });
});

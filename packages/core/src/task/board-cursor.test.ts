import { describe, expect, it } from "vitest";

import { decodeBoardCursor, encodeBoardCursor } from "./board-cursor";

const ID = "0199a4c2-7a10-7000-8000-000000000301";
const KEY = "2026-11-26T09:00:00.000Z";

describe("board cursor", () => {
  it("fa il round-trip di una chiave con il suo id", () => {
    expect(decodeBoardCursor(encodeBoardCursor({ key: KEY, id: ID }))).toEqual({
      key: KEY,
      id: ID,
    });
  });

  it("fa il round-trip di una chiave null", () => {
    expect(decodeBoardCursor(encodeBoardCursor({ key: null, id: ID }))).toEqual({
      key: null,
      id: ID,
    });
  });

  it("rifiuta un valore non decodificabile", () => {
    expect(decodeBoardCursor("non-un-cursore")).toBeNull();
  });

  it("rifiuta un id che non è un UUID", () => {
    expect(decodeBoardCursor(encodeBoardCursor({ key: KEY, id: "not-a-uuid" }))).toBeNull();
  });

  it("rifiuta una chiave che non è null né una data", () => {
    expect(decodeBoardCursor(encodeBoardCursor({ key: "non-una-data", id: ID }))).toBeNull();
  });
});

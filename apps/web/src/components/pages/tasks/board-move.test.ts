import { describe, expect, it } from "vitest";

import type { BoardStatus } from "@web/lib/queries/board";
import { boardCommand } from "./board-move";
import type { BoardCommand } from "./board-move";

describe("boardCommand", () => {
  it("completes from either active column", () => {
    expect(boardCommand("open", "completed")).toEqual({ kind: "complete" });
    expect(boardCommand("in_progress", "completed")).toEqual({ kind: "complete" });
  });

  it("reopens a completed task to the column it was dropped on", () => {
    expect(boardCommand("completed", "open")).toEqual({ kind: "reopen", to: "open" });
    expect(boardCommand("completed", "in_progress")).toEqual({
      kind: "reopen",
      to: "in_progress",
    });
  });

  it("moves between the active columns", () => {
    expect(boardCommand("open", "in_progress")).toEqual({ kind: "start" });
    expect(boardCommand("in_progress", "open")).toEqual({ kind: "todo" });
  });

  it("ignores a drop on the same column", () => {
    expect(boardCommand("open", "open")).toBeNull();
    expect(boardCommand("in_progress", "in_progress")).toBeNull();
    expect(boardCommand("completed", "completed")).toBeNull();
  });
});

// Copre tutte e nove le coppie di colonne: ogni esito e atteso una volta sola.
const ALL_PAIRS: readonly (readonly [BoardStatus, BoardStatus, BoardCommand | null])[] = [
  ["open", "open", null],
  ["open", "in_progress", { kind: "start" }],
  ["open", "completed", { kind: "complete" }],
  ["in_progress", "open", { kind: "todo" }],
  ["in_progress", "in_progress", null],
  ["in_progress", "completed", { kind: "complete" }],
  ["completed", "open", { kind: "reopen", to: "open" }],
  ["completed", "in_progress", { kind: "reopen", to: "in_progress" }],
  ["completed", "completed", null],
];

describe("boardCommand over every column pair", () => {
  it.each(ALL_PAIRS)("%s -> %s", (from, to, expected) => {
    expect(boardCommand(from, to)).toEqual(expected);
  });
});

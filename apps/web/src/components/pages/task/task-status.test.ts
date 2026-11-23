import { describe, expect, it } from "vitest";

import { statusCommand } from "./task-status";

describe("statusCommand", () => {
  it("maps working-state changes and closures from an open or in-progress task", () => {
    expect(statusCommand("open", "in_progress")).toEqual({ kind: "start" });
    expect(statusCommand("in_progress", "open")).toEqual({ kind: "todo" });
    expect(statusCommand("in_progress", "completed")).toEqual({ kind: "complete" });
    expect(statusCommand("open", "skipped")).toEqual({ kind: "skip" });
    expect(statusCommand("in_progress", "cancelled")).toEqual({ kind: "cancel" });
  });

  it("leaves a completed task only through a reopen", () => {
    expect(statusCommand("completed", "open")).toEqual({ kind: "reopen", to: "open" });
    expect(statusCommand("completed", "in_progress")).toEqual({
      kind: "reopen",
      to: "in_progress",
    });
    expect(statusCommand("completed", "skipped")).toBeNull();
  });

  it("never leaves skipped or cancelled, and ignores the same status", () => {
    expect(statusCommand("skipped", "open")).toBeNull();
    expect(statusCommand("cancelled", "in_progress")).toBeNull();
    expect(statusCommand("open", "open")).toBeNull();
  });
});

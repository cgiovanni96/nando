import { describe, expect, it } from "vitest";

import { LEADER_TIMEOUT_MS, nextLeaderCommand } from "./leader";

describe("leader shortcuts", () => {
  it("starts on n and resolves the second key inside the window", () => {
    const started = nextLeaderCommand(null, "n", 1_000);

    expect(started).toEqual({ state: { startedAt: 1_000 }, command: null });

    for (const [key, command] of [
      ["n", "capture"],
      ["d", "dashboard"],
      ["i", "inbox"],
      ["t", "trash"],
    ] as const) {
      expect(nextLeaderCommand({ startedAt: 1_000 }, key, 1_000 + LEADER_TIMEOUT_MS)).toEqual({
        state: null,
        command,
      });
    }
  });

  it("does not resolve a second key after the window", () => {
    expect(nextLeaderCommand({ startedAt: 1_000 }, "d", 1_000 + LEADER_TIMEOUT_MS + 1)).toEqual({
      state: null,
      command: null,
    });
  });

  it("starts a new leader when n arrives after the window", () => {
    expect(nextLeaderCommand({ startedAt: 1_000 }, "n", 2_000)).toEqual({
      state: { startedAt: 2_000 },
      command: null,
    });
  });

  it("resets on an unknown second key", () => {
    expect(nextLeaderCommand({ startedAt: 1_000 }, "x", 1_100)).toEqual({
      state: null,
      command: null,
    });
  });

  it("ignores a key that is not the leader", () => {
    expect(nextLeaderCommand(null, "d", 1_000)).toEqual({ state: null, command: null });
  });
});

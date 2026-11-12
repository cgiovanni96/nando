import { test } from "@fast-check/vitest";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  dueAtViolation,
  normalizeTaskTitle,
  restorableUntil,
  restoreViolation,
  spaceViolation,
  TASK_DELETION_GRACE_DAYS,
  TASK_STATUS_TARGETS,
  TASK_STATUSES,
  TASK_TITLE_MAX_LENGTH,
  titleViolation,
  transitionViolation,
} from "./domain";

const taskStatus = fc.constantFrom(...TASK_STATUSES);

describe("task status transitions", () => {
  it("lets an open task move to every terminal status", () => {
    expect(transitionViolation("open", "completed")).toBeNull();
    expect(transitionViolation("open", "skipped")).toBeNull();
    expect(transitionViolation("open", "cancelled")).toBeNull();
  });

  it("treats the same status as an idempotent no-op", () => {
    expect(transitionViolation("completed", "completed")).toBeNull();
    expect(transitionViolation("skipped", "skipped")).toBeNull();
    expect(transitionViolation("cancelled", "cancelled")).toBeNull();
  });

  it("does not reopen or cross terminal states", () => {
    expect(transitionViolation("completed", "skipped")).toMatchObject({
      code: "domain_rule_violation",
    });
    expect(transitionViolation("skipped", "completed")).toMatchObject({
      code: "domain_rule_violation",
    });
    expect(transitionViolation("cancelled", "completed")).toMatchObject({
      code: "domain_rule_violation",
    });
  });

  it("maps each command to its target status", () => {
    expect(TASK_STATUS_TARGETS).toEqual({
      complete: "completed",
      skip: "skipped",
      cancel: "cancelled",
    });
  });
});

describe("task status transitions (properties)", () => {
  test.prop([taskStatus])("the same status is always a no-op", (status) => {
    expect(transitionViolation(status, status)).toBeNull();
  });

  test.prop([taskStatus, taskStatus])("a status changes only from open", (from, to) => {
    const violation = transitionViolation(from, to);

    if (from === "open" || from === to) expect(violation).toBeNull();
    else expect(violation).toMatchObject({ code: "domain_rule_violation" });
  });
});

describe("task fields", () => {
  it("requires a non-empty title within the limit", () => {
    expect(titleViolation("Comprare il pane")).toBeNull();
    expect(titleViolation("   ")).toMatchObject({ code: "validation_error" });
    expect(titleViolation("x".repeat(501))).toMatchObject({ code: "validation_error" });
  });

  it("rejects an invalid due date", () => {
    expect(dueAtViolation(null)).toBeNull();
    expect(dueAtViolation(new Date("2026-11-12T10:00:00.000Z"))).toBeNull();
    expect(dueAtViolation(new Date("not-a-date"))).toMatchObject({ code: "validation_error" });
  });
});

describe("task titles (properties)", () => {
  test.prop([fc.string()])("normalization is idempotent", (title) => {
    const normalized = normalizeTaskTitle(title);

    expect(normalizeTaskTitle(normalized)).toBe(normalized);
  });

  test.prop([fc.string()])("validity depends only on the normalized length", (title) => {
    const normalized = normalizeTaskTitle(title);
    const valid = normalized.length > 0 && normalized.length <= TASK_TITLE_MAX_LENGTH;

    expect(titleViolation(title) === null).toBe(valid);
  });
});

describe("task space", () => {
  it("rejects missing, deleted and archived spaces", () => {
    expect(spaceViolation(null)).toMatchObject({ code: "not_found" });
    expect(spaceViolation({ id: "s1", archivedAt: null, deletedAt: new Date() })).toMatchObject({
      code: "not_found",
    });
    expect(spaceViolation({ id: "s1", archivedAt: new Date(), deletedAt: null })).toMatchObject({
      code: "domain_rule_violation",
    });
    expect(spaceViolation({ id: "s1", archivedAt: null, deletedAt: null })).toBeNull();
  });
});

describe("task deletion grace window", () => {
  const deletedAt = new Date("2026-11-12T10:00:00.000Z");
  const deadline = new Date("2026-11-19T10:00:00.000Z");

  it("keeps the window at seven days", () => {
    expect(TASK_DELETION_GRACE_DAYS).toBe(7);
    expect(restorableUntil(deletedAt)).toEqual(deadline);
  });

  it("does not touch an active task", () => {
    expect(restoreViolation(null, deadline)).toBeNull();
  });

  it("allows a restore inside the window, including the boundary", () => {
    expect(restoreViolation(deletedAt, deletedAt)).toBeNull();
    expect(restoreViolation(deletedAt, new Date("2026-11-19T09:59:59.999Z"))).toBeNull();
    expect(restoreViolation(deletedAt, deadline)).toBeNull();
  });

  it("refuses a restore after the window and reports the deadline", () => {
    const violation = restoreViolation(deletedAt, new Date("2026-11-19T10:00:00.001Z"));

    expect(violation).toMatchObject({
      code: "domain_rule_violation",
      details: { restorableUntil: "2026-11-19T10:00:00.000Z" },
    });
  });

  test.prop([
    fc.date({ min: new Date("2026-01-01"), max: new Date("2027-01-01"), noInvalidDate: true }),
  ])("the window is exactly seven days wide", (candidate) => {
    const inside = new Date(candidate.getTime() + 7 * 24 * 60 * 60 * 1000);

    expect(restoreViolation(candidate, inside)).toBeNull();
    expect(restoreViolation(candidate, new Date(inside.getTime() + 1))).not.toBeNull();
  });
});

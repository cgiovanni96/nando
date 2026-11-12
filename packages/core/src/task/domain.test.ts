import { test } from "@fast-check/vitest";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  dueAtViolation,
  normalizeTaskTitle,
  spaceViolation,
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

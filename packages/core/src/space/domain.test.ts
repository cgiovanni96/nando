import { test } from "@fast-check/vitest";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  canContain,
  mutationViolation,
  nameViolation,
  normalizeSpaceName,
  parentViolation,
  spaceStatus,
  SPACE_KINDS,
  SPACE_NAME_MAX_LENGTH,
  type SpaceKind,
} from "./domain";

const spaceKind = fc.constantFrom(...SPACE_KINDS);
const maybeDate = fc.option(fc.date(), { nil: null });

/** La grammatica PARA, riscritta come tabella: se cambia, deve cambiare qui. */
const CONTAINMENT: Record<SpaceKind, readonly SpaceKind[]> = {
  area: ["area", "project"],
  project: ["resource"],
  resource: [],
};

describe("PARA grammar", () => {
  it("lets an area contain areas and projects", () => {
    expect(canContain("area", "area")).toBe(true);
    expect(canContain("area", "project")).toBe(true);
    expect(canContain("area", "resource")).toBe(false);
  });

  it("lets a project contain only resources", () => {
    expect(canContain("project", "resource")).toBe(true);
    expect(canContain("project", "area")).toBe(false);
    expect(canContain("project", "project")).toBe(false);
  });

  it("makes a resource a leaf", () => {
    for (const kind of SPACE_KINDS) {
      expect(canContain("resource", kind)).toBe(false);
    }
  });
});

describe("space lifecycle", () => {
  it("derives the status from deletedAt and archivedAt", () => {
    expect(spaceStatus({ archivedAt: null, deletedAt: null })).toBe("active");
    expect(spaceStatus({ archivedAt: new Date(), deletedAt: null })).toBe("archived");
    expect(spaceStatus({ archivedAt: new Date(), deletedAt: new Date() })).toBe("deleted");
  });

  it("rejects mutations in an archived space", () => {
    expect(mutationViolation({ archivedAt: null, deletedAt: null })).toBeNull();
    expect(mutationViolation({ archivedAt: new Date(), deletedAt: null })).toMatchObject({
      code: "domain_rule_violation",
    });
    expect(mutationViolation({ archivedAt: null, deletedAt: new Date() })).toMatchObject({
      code: "not_found",
    });
  });
});

describe("parent rules", () => {
  const activeArea = { kind: "area" as const, archivedAt: null, deletedAt: null };
  const archivedArea = { kind: "area" as const, archivedAt: new Date(), deletedAt: null };
  const deletedArea = { kind: "area" as const, archivedAt: null, deletedAt: new Date() };
  const activeProject = { kind: "project" as const, archivedAt: null, deletedAt: null };

  it("accepts a child that respects the grammar", () => {
    expect(parentViolation(activeArea, "project")).toBeNull();
    expect(parentViolation(activeProject, "resource")).toBeNull();
  });

  it("rejects a child that breaks the grammar", () => {
    expect(parentViolation(activeArea, "resource")).toMatchObject({
      code: "domain_rule_violation",
    });
    expect(parentViolation(activeProject, "area")).toMatchObject({
      code: "domain_rule_violation",
    });
  });

  it("keeps an archived space read-only and hides a deleted one", () => {
    expect(parentViolation(archivedArea, "project")).toMatchObject({
      code: "domain_rule_violation",
    });
    expect(parentViolation(deletedArea, "project")).toMatchObject({ code: "not_found" });
  });
});

describe("space name", () => {
  it("trims the name", () => {
    expect(normalizeSpaceName("  Vita  ")).toBe("Vita");
  });

  it("requires a non-empty name within the limit", () => {
    expect(nameViolation("Vita")).toBeNull();
    expect(nameViolation("   ")).toMatchObject({ code: "validation_error" });
    expect(nameViolation("x".repeat(SPACE_NAME_MAX_LENGTH + 1))).toMatchObject({
      code: "validation_error",
    });
  });
});

describe("space rules (properties)", () => {
  test.prop([spaceKind, spaceKind])("canContain follows the PARA table", (parent, child) => {
    expect(canContain(parent, child)).toBe(CONTAINMENT[parent].includes(child));
  });

  test.prop([maybeDate, maybeDate])(
    "deleted wins over archived and active",
    (archivedAt, deletedAt) => {
      const expected = deletedAt ? "deleted" : archivedAt ? "archived" : "active";

      expect(spaceStatus({ archivedAt, deletedAt })).toBe(expected);
    },
  );

  test.prop([fc.string()])("normalization is idempotent", (name) => {
    const normalized = normalizeSpaceName(name);

    expect(normalizeSpaceName(normalized)).toBe(normalized);
  });

  test.prop([fc.string()])("validity depends only on the normalized length", (name) => {
    const normalized = normalizeSpaceName(name);
    const valid = normalized.length > 0 && normalized.length <= SPACE_NAME_MAX_LENGTH;

    expect(nameViolation(name) === null).toBe(valid);
  });
});

import type { DomainError } from "@nando/kernel";

export const SPACE_KINDS = ["area", "project", "resource"] as const;

export type SpaceKind = (typeof SPACE_KINDS)[number];

export const SPACE_NAME_MAX_LENGTH = 120;

export type Space = {
  id: string;
  name: string;
  kind: SpaceKind;
  parentId: string | null;
  completedAt: Date | null;
  archivedAt: Date | null;
  deletedAt: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

export type SpaceStatus = "active" | "archived" | "deleted";

export type InboxItem = {
  entityType: string;
  id: string;
  title: string;
  updatedAt: Date;
};

export type InboxCursor = {
  updatedAt: string;
  entityType: string;
  id: string;
};

const KIND_LABELS: Record<SpaceKind, string> = {
  area: "area",
  project: "progetto",
  resource: "risorsa",
};

/**
 * Grammatica PARA: un'Area contiene Aree e Progetti, un Progetto contiene
 * Risorse, una Risorsa è foglia. Tutti possono stare alla radice.
 */
export function canContain(parentKind: SpaceKind, childKind: SpaceKind): boolean {
  switch (parentKind) {
    case "area":
      return childKind === "area" || childKind === "project";
    case "project":
      return childKind === "resource";
    case "resource":
      return false;
  }
}

export function spaceStatus(space: Pick<Space, "archivedAt" | "deletedAt">): SpaceStatus {
  if (space.deletedAt) return "deleted";
  if (space.archivedAt) return "archived";
  return "active";
}

export function normalizeSpaceName(name: string): string {
  return name.trim();
}

export function nameViolation(name: string): DomainError | null {
  const normalized = normalizeSpaceName(name);

  if (normalized.length === 0) {
    return { code: "validation_error", message: "Il nome dello Space è obbligatorio." };
  }

  if (normalized.length > SPACE_NAME_MAX_LENGTH) {
    return {
      code: "validation_error",
      message: `Il nome dello Space non può superare ${SPACE_NAME_MAX_LENGTH} caratteri.`,
    };
  }

  return null;
}

export function mutationViolation(
  space: Pick<Space, "archivedAt" | "deletedAt">,
): DomainError | null {
  const status = spaceStatus(space);

  if (status === "deleted") {
    return { code: "not_found", message: "Space non trovato." };
  }

  if (status === "archived") {
    return { code: "domain_rule_violation", message: "Uno Space archiviato è in sola lettura." };
  }

  return null;
}

export function parentViolation(
  parent: Pick<Space, "kind" | "archivedAt" | "deletedAt">,
  childKind: SpaceKind,
): DomainError | null {
  if (spaceStatus(parent) === "deleted") {
    return { code: "not_found", message: "Space genitore non trovato." };
  }

  if (spaceStatus(parent) === "archived") {
    return {
      code: "domain_rule_violation",
      message: "Uno Space archiviato è in sola lettura.",
    };
  }

  if (!canContain(parent.kind, childKind)) {
    return {
      code: "domain_rule_violation",
      message: `Un ${KIND_LABELS[parent.kind]} non può contenere ${KIND_LABELS[childKind]}.`,
    };
  }

  return null;
}

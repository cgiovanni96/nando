// Mapping dominio -> DTO del gruppo Space: nessun `Date` attraversa il wire.

import type { Space } from "@nando/core";

import type { SpaceDto } from "./contract/shared";

/** Converte i timestamp del dominio in stringhe ISO 8601 UTC. */
export function toSpaceDto(space: Space): SpaceDto {
  return {
    id: space.id,
    name: space.name,
    kind: space.kind,
    parentId: space.parentId,
    completedAt: space.completedAt?.toISOString() ?? null,
    archivedAt: space.archivedAt?.toISOString() ?? null,
    version: space.version,
    createdAt: space.createdAt.toISOString(),
    updatedAt: space.updatedAt.toISOString(),
  };
}

// Mapping dominio -> DTO del gruppo Task: nessun `Date` attraversa il wire.

import { restorableUntil, type Task } from "@nando/core";

import type { TaskDto } from "./contract/shared";

/** Converte la scadenza del dominio in stringa ISO 8601 UTC. */
export function toTaskDto(task: Task): TaskDto {
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    dueAt: task.dueAt?.toISOString() ?? null,
    dueAtHasTime: task.dueAtHasTime,
    spaceId: task.spaceId,
    version: task.version,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    deletedAt: task.deletedAt?.toISOString() ?? null,
    restorableUntil: task.deletedAt ? restorableUntil(task.deletedAt).toISOString() : null,
  };
}

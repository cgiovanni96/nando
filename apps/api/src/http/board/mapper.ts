// Mapping dominio -> DTO della vista Board: la data resta `YYYY-MM-DD`.

import type { BoardEntry } from "@nando/core";

import { toTaskDto } from "@api/http/tasks/mapper";
import type { BoardItemDto } from "./contract";

export function toBoardItemDto(entry: BoardEntry): BoardItemDto {
  return {
    ...toTaskDto(entry),
    dueDate: entry.dueDate,
    temporalState: entry.temporalState,
    completedAt: entry.completedAt?.toISOString() ?? null,
  };
}

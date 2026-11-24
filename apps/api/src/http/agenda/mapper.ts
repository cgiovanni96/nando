// Mapping dominio -> DTO della vista Agenda: i giorni locali sono già date wire.

import type { AgendaEntry } from "@nando/core";

import { toScheduleDto, toTaskDto } from "@api/http/tasks/mapper";
import type { AgendaItemDto } from "./contract";

export function toAgendaItemDto(entry: AgendaEntry): AgendaItemDto {
  return {
    ...toTaskDto(entry),
    schedule: toScheduleDto(entry.schedule),
    temporalState: entry.temporalState,
    dueDate: entry.dueDate,
    startDate: entry.startDate,
  };
}

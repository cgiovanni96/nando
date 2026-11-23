// Mapping dominio -> DTO del gruppo Task: nessun `Date` attraversa il wire.

import { restorableUntil, type Schedule, type Task } from "@nando/core";

import type { ScheduleDto, TaskDto } from "./contract/shared";

/** Date locali restano `YYYY-MM-DD`; gli istanti diventano ISO 8601 UTC. */
function toScheduleDto(schedule: Schedule): ScheduleDto {
  return schedule.allDay
    ? { allDay: true, from: schedule.from, to: schedule.to, timeZone: schedule.timeZone }
    : {
        allDay: false,
        from: schedule.from?.toISOString() ?? null,
        to: schedule.to.toISOString(),
        timeZone: schedule.timeZone,
      };
}

export function toTaskDto(task: Task): TaskDto {
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    schedule: task.schedule ? toScheduleDto(task.schedule) : null,
    timeZone: task.timeZone,
    spaceId: task.spaceId,
    version: task.version,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    deletedAt: task.deletedAt?.toISOString() ?? null,
    restorableUntil: task.deletedAt ? restorableUntil(task.deletedAt).toISOString() : null,
  };
}

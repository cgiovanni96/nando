import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

import type { ScheduleInput } from "@web/lib/calendar/schedule-move";
import type { AgendaItem } from "@web/lib/queries/agenda";
import type { TaskItem } from "@web/lib/queries/tasks";

dayjs.extend(utc);
dayjs.extend(timezone);

type Schedulable = TaskItem | AgendaItem;

/** Giorno di calendario di un istante nella timezone del Task. */
function localDate(instant: string, timeZone: string): string {
  return dayjs(instant).tz(timeZone).format("YYYY-MM-DD");
}

/**
 * La voce d'agenda che il server restituirebbe dopo lo spostamento: giorni
 * locali ricalcolati nella timezone del Task. Lo stato temporale si tiene se
 * c'è, altrimenti `upcoming`: il refetch lo corregge.
 */
export function withSchedule(task: Schedulable, schedule: ScheduleInput): AgendaItem {
  const timeZone = task.timeZone;
  const next = schedule.allDay
    ? { allDay: true as const, from: schedule.from, to: schedule.to, timeZone }
    : { allDay: false as const, from: schedule.from, to: schedule.to, timeZone };

  return {
    ...task,
    schedule: next,
    dueDate: next.allDay ? next.to : localDate(next.to, timeZone),
    startDate: next.from === null ? null : next.allDay ? next.from : localDate(next.from, timeZone),
    temporalState: ("temporalState" in task ? task.temporalState : null) ?? "upcoming",
  };
}

/**
 * Mette `moved` al posto della voce con lo stesso id; se manca la aggiunge solo
 * quando cade nell'intervallo mostrato. L'array in ingresso non viene mutato.
 */
export function placeInCalendar(
  items: AgendaItem[],
  moved: AgendaItem,
  range: { from: string; to: string },
): AgendaItem[] {
  if (items.some((item) => item.id === moved.id)) {
    return items.map((item) => (item.id === moved.id ? moved : item));
  }

  const start = moved.startDate ?? moved.dueDate;

  return start <= range.to && moved.dueDate >= range.from ? [...items, moved] : items;
}

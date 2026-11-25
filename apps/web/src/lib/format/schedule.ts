import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

import type { CalendarEvent } from "@web/lib/calendar/agenda-event";
import { toCalendarEvent } from "@web/lib/calendar/agenda-event";
import type { AgendaItem } from "@web/lib/queries/agenda";

import { formatLocalDate } from "./datetime";

dayjs.extend(utc);
dayjs.extend(timezone);

const WALL_CLOCK_FORMAT = "YYYY-MM-DD HH:mm:ss";

function time(value: string): string {
  return value.slice(11, 16);
}

function day(value: string): string {
  return formatLocalDate(value.slice(0, 10), "short");
}

function isAllDay(event: CalendarEvent): boolean {
  return event.payload.kind === "allDay" || event.payload.kind === "allDayRange";
}

/**
 * Fine "da parete" dello Schedule. Non passa da `toCalendarEvent`: con la fine
 * dell'ora legale l'orologio torna indietro e la fine reale precede l'inizio.
 */
function scheduleEnd(item: AgendaItem): string {
  return dayjs(item.schedule.to).tz(item.schedule.timeZone).format(WALL_CLOCK_FORMAT);
}

/** Orario breve dell'occorrenza nella timezone dello Schedule; `null` per l'intera giornata. */
export function formatScheduleTime(item: AgendaItem): string | null {
  const event = toCalendarEvent(item);

  if (isAllDay(event)) return null;
  if (event.payload.kind === "point") return time(event.start);

  return `${time(event.start)} – ${time(scheduleEnd(item))}`;
}

/** Giorno e orario dell'occorrenza, con l'intervallo su più giorni scritto per esteso. */
export function formatScheduleLabel(item: AgendaItem): string {
  const event = toCalendarEvent(item);
  const schedule = item.schedule;

  if (schedule.allDay) {
    if (event.payload.kind === "allDayRange" && schedule.from !== null) {
      const from = formatLocalDate(schedule.from, "short");
      const to = formatLocalDate(schedule.to, "short");

      return `${from} – ${to}`;
    }

    return formatLocalDate(schedule.to, "short");
  }

  if (event.payload.kind === "point") {
    return `${day(event.start)}, ${time(event.start)}`;
  }

  const startDay = day(event.start);
  const end = scheduleEnd(item);
  const endDay = day(end);

  return startDay === endDay
    ? `${startDay}, ${time(event.start)} – ${time(end)}`
    : `${startDay}, ${time(event.start)} – ${endDay}, ${time(end)}`;
}

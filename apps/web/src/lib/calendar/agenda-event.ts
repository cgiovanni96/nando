import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

import { addDays } from "@web/lib/local-date";
import type { AgendaItem } from "@web/lib/queries/agenda";

dayjs.extend(utc);
dayjs.extend(timezone);

export type CalendarView = "month" | "week" | "day" | "agenda";

export type CalendarEventKind = "allDay" | "allDayRange" | "point" | "range";

export type CalendarEvent = {
  id: string;
  title: string;
  /** Ora "da parete" in `schedule.timeZone`, `YYYY-MM-DD HH:mm:ss`. */
  start: string;
  end: string;
  color: string;
  payload: { item: AgendaItem; kind: CalendarEventKind };
};

/** Durata convenzionale di un punto, in minuti. */
export const POINT_MINUTES = 30;

const WALL_CLOCK_FORMAT = "YYYY-MM-DD HH:mm:ss";
const END_OF_DAY = "23:59:59";
const MONTH_DAYS = 42;
const AGENDA_DAYS = 13;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function wallClock(instant: string, timeZone: string): string {
  return dayjs(instant).tz(timeZone).format(WALL_CLOCK_FORMAT);
}

/** Fine di un punto: `POINT_MINUTES` dopo l'inizio, mai oltre la mezzanotte. */
function pointEnd(start: string): string {
  const date = start.slice(0, 10);
  const [hours = "0", minutes = "0", seconds = "0"] = start.slice(11).split(":");
  const end = new Date(
    Date.UTC(2000, 0, 1, Number(hours), Number(minutes) + POINT_MINUTES, Number(seconds)),
  );

  if (end.getUTCDate() !== 1) {
    return `${date} ${END_OF_DAY}`;
  }

  return `${date} ${pad(end.getUTCHours())}:${pad(end.getUTCMinutes())}:${pad(
    end.getUTCSeconds(),
  )}`;
}

function eventKind(schedule: AgendaItem["schedule"]): CalendarEventKind {
  if (schedule.allDay) {
    return schedule.from !== null && schedule.from < schedule.to ? "allDayRange" : "allDay";
  }

  return schedule.from === null || schedule.from === schedule.to ? "point" : "range";
}

function eventTimes(
  schedule: AgendaItem["schedule"],
  kind: CalendarEventKind,
): { start: string; end: string } {
  if (schedule.allDay) {
    const from = schedule.from ?? schedule.to;

    return {
      start: `${from} 00:00:00`,
      end: `${addDays(schedule.to, 1)} 00:00:00`,
    };
  }

  const start = wallClock(schedule.from ?? schedule.to, schedule.timeZone);

  if (kind === "point") {
    return { start, end: pointEnd(start) };
  }

  const end = wallClock(schedule.to, schedule.timeZone);

  // Fine dell'ora legale: l'orologio torna indietro e la fine non segue l'inizio.
  return end > start ? { start, end } : { start, end: pointEnd(start) };
}

export function toCalendarEvent(item: AgendaItem): CalendarEvent {
  const kind = eventKind(item.schedule);
  const { start, end } = eventTimes(item.schedule, kind);

  return {
    id: item.id,
    title: item.title,
    start,
    end,
    color: item.temporalState === "overdue" ? "red" : "gray",
    payload: { item, kind },
  };
}

/** Solo la parte del giorno `date`: gli eventi che la attraversano vengono tagliati. */
export function clipToDay(events: CalendarEvent[], date: string): CalendarEvent[] {
  const dayStart = `${date} 00:00:00`;
  const dayEnd = `${addDays(date, 1)} 00:00:00`;

  return events
    .filter((event) => event.start < dayEnd && event.end > dayStart)
    .map((event) => ({
      ...event,
      start: event.start > dayStart ? event.start : dayStart,
      end: event.end < dayEnd ? event.end : dayEnd,
    }));
}

/** Eventi che toccano i giorni `from`–`to` inclusi, senza tagliarli. */
export function inRange(events: CalendarEvent[], from: string, to: string): CalendarEvent[] {
  const rangeStart = `${from} 00:00:00`;
  const rangeEnd = `${addDays(to, 1)} 00:00:00`;

  return events.filter((event) => event.start < rangeEnd && event.end > rangeStart);
}

/**
 * La libreria disegna in testata un evento che finisce dopo la mezzanotte del giorno d'inizio,
 * oppure un giorno intero esatto.
 */
export function isAllDayRow(event: CalendarEvent): boolean {
  const startDay = event.start.slice(0, 10);
  const nextMidnight = `${addDays(startDay, 1)} 00:00:00`;

  return (
    event.end > nextMidnight ||
    (event.start === `${startDay} 00:00:00` && event.end === nextMidnight)
  );
}

/** Eventi come li vuole la settimana: quelli in testata occupano giorni interi. */
export function toWeekEvents(events: CalendarEvent[]): CalendarEvent[] {
  return events.map((event) => {
    if (!isAllDayRow(event)) {
      return event;
    }

    const startDay = event.start.slice(0, 10);
    const endDay = event.end.slice(0, 10);

    return {
      ...event,
      start: `${startDay} 00:00:00`,
      end: event.end === `${endDay} 00:00:00` ? event.end : `${addDays(endDay, 1)} 00:00:00`,
    };
  });
}

/** Righe di testata necessarie: il giorno più affollato dell'intervallo. */
export function allDayRows(events: CalendarEvent[], from: string, to: string): number {
  const rows = toWeekEvents(events).filter(isAllDayRow);
  let highest = 0;

  for (let day = from; day <= to; day = addDays(day, 1)) {
    const dayStart = `${day} 00:00:00`;
    const dayEnd = `${addDays(day, 1)} 00:00:00`;
    const count = rows.filter((event) => event.start < dayEnd && event.end > dayStart).length;

    highest = Math.max(highest, count);
  }

  return highest;
}

function weekdayOffset(date: string): number {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();

  return (weekday + 6) % 7;
}

function weekStart(date: string): string {
  return addDays(date, -weekdayOffset(date));
}

/** Estremi inclusi della vista; il mese copre sempre 42 giorni da lunedì. */
export function viewRange(view: CalendarView, date: string): { from: string; to: string } {
  switch (view) {
    case "month": {
      const from = weekStart(`${date.slice(0, 7)}-01`);

      return { from, to: addDays(from, MONTH_DAYS - 1) };
    }
    case "week": {
      const from = weekStart(date);

      return { from, to: addDays(from, 6) };
    }
    case "day":
      return { from: date, to: date };
    case "agenda":
      return { from: date, to: addDays(date, AGENDA_DAYS) };
  }
}

/** Sposta la data di un passo nella vista: il mese va al primo giorno adiacente. */
export function shiftDate(view: CalendarView, date: string, step: 1 | -1): string {
  switch (view) {
    case "month": {
      const first = new Date(`${date.slice(0, 7)}-01T00:00:00Z`);
      first.setUTCMonth(first.getUTCMonth() + step);

      return `${first.getUTCFullYear()}-${pad(first.getUTCMonth() + 1)}-01`;
    }
    case "week":
      return addDays(date, 7 * step);
    case "day":
      return addDays(date, step);
    case "agenda":
      return addDays(date, 14 * step);
  }
}

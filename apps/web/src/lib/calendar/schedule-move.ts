import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

import { addDays } from "@web/lib/local-date";
import type { UpdateTaskInput } from "@web/lib/mutations/tasks";
import type { AgendaItem } from "@web/lib/queries/agenda";

dayjs.extend(utc);
dayjs.extend(timezone);

export type ScheduleDto = AgendaItem["schedule"];
export type ScheduleInput = NonNullable<UpdateTaskInput["schedule"]>;

const WALL_CLOCK_FORMAT = "YYYY-MM-DD HH:mm:ss";
const DAY = 24 * 60 * 60 * 1000;

/** Orologio "da parete" di un istante, nella timezone dello Schedule. */
function wallClock(iso: string, timeZone: string): string {
  return dayjs(iso).tz(timeZone).format(WALL_CLOCK_FORMAT);
}

/** Istante di un orologio "da parete" nella timezone dello Schedule. */
function instant(wallClockValue: string, timeZone: string): string {
  return dayjs.tz(wallClockValue, WALL_CLOCK_FORMAT, timeZone).toISOString();
}

/** Millisecondi di un orologio "da parete", letti come se fossero UTC. */
function wallClockMilliseconds(value: string): number {
  return Date.parse(`${value.slice(0, 10)}T${value.slice(11, 19)}Z`);
}

function wallClockFrom(milliseconds: number): string {
  return new Date(milliseconds).toISOString().slice(0, 19).replace("T", " ");
}

/** Giorni interi fra due giorni `YYYY-MM-DD`. */
function wholeDays(from: string, to: string): number {
  const days =
    (wallClockMilliseconds(`${to} 00:00:00`) - wallClockMilliseconds(`${from} 00:00:00`)) / DAY;

  return Math.round(days);
}

/** Sposta un orologio "da parete" e lo rilegge come istante: l'ora locale resta. */
function shiftedInstant(wallClockValue: string, shift: number, timeZone: string): string {
  return instant(wallClockFrom(wallClockMilliseconds(wallClockValue) + shift), timeZone);
}

export function moveSchedule(
  schedule: ScheduleDto,
  drop: { shownStart: string; newStart: string; grabbedDay: string | null },
): ScheduleInput | null {
  const { shownStart, newStart, grabbedDay } = drop;

  let shift = wallClockMilliseconds(newStart) - wallClockMilliseconds(shownStart);

  if (grabbedDay !== null) {
    shift -= wholeDays(shownStart.slice(0, 10), grabbedDay) * DAY;
  }

  if (shift === 0) return null;

  if (schedule.allDay) {
    const days = Math.floor(shift / DAY);
    if (days === 0) return null;

    return {
      allDay: true,
      from: schedule.from === null ? null : addDays(schedule.from, days),
      to: addDays(schedule.to, days),
    };
  }

  const start = shiftedInstant(
    wallClock(schedule.from ?? schedule.to, schedule.timeZone),
    shift,
    schedule.timeZone,
  );
  const duration = schedule.from === null ? 0 : Date.parse(schedule.to) - Date.parse(schedule.from);

  const moved = {
    from: schedule.from === null ? null : start,
    to: new Date(Date.parse(start) + duration).toISOString(),
  };

  const unchanged =
    (moved.from === null
      ? schedule.from === null
      : schedule.from !== null && Date.parse(moved.from) === Date.parse(schedule.from)) &&
    Date.parse(moved.to) === Date.parse(schedule.to);

  if (unchanged) return null;

  return { allDay: false, from: moved.from, to: moved.to };
}

export function resizeSchedule(
  schedule: ScheduleDto,
  resize: { shownStart: string; shownEnd: string; newStart: string; newEnd: string },
): ScheduleInput | null {
  if (
    schedule.allDay ||
    schedule.from === null ||
    Date.parse(schedule.from) === Date.parse(schedule.to)
  ) {
    return null;
  }

  const startChanged = resize.newStart !== resize.shownStart;
  const endChanged = resize.newEnd !== resize.shownEnd;
  if (!startChanged && !endChanged) return null;

  // Il bordo trascinato è l'istante mostrato, non uno spostamento del bordo reale:
  // una fascia iniziata ieri e tagliata a 00:00 deve poter iniziare oggi.
  const from = startChanged ? instant(resize.newStart, schedule.timeZone) : schedule.from;
  const to = endChanged ? instant(resize.newEnd, schedule.timeZone) : schedule.to;

  const unchanged =
    Date.parse(from) === Date.parse(schedule.from) && Date.parse(to) === Date.parse(schedule.to);

  if (unchanged || Date.parse(from) >= Date.parse(to)) return null;

  return { allDay: false, from, to };
}

export function planSchedule(
  drop: { dateTime: string; allDay: boolean },
  timeZone: string,
): ScheduleInput {
  if (drop.allDay) {
    return { allDay: true, from: null, to: drop.dateTime.slice(0, 10) };
  }

  return { allDay: false, from: null, to: instant(drop.dateTime, timeZone) };
}

import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

import type { UpdateTaskInput } from "@web/lib/mutations/tasks";
import type { TaskDetail } from "@web/lib/queries/tasks";

dayjs.extend(utc);
dayjs.extend(timezone);

type ScheduleDto = NonNullable<TaskDetail["schedule"]>;
type ScheduleInputDto = UpdateTaskInput["schedule"];

/** Giorno e ora come li vede l'utente, nella timezone del task. */
export type WallClock = { date: string; time: string };

/**
 * Stato del campo Schedule della pagina task. Lavora su giorno e ora "da
 * parete" nella timezone del task, così il browser in un altro fuso non sposta
 * le scadenze; la conversione a istanti avviene solo in `scheduleFromDraft`.
 */
export type ScheduleDraft = {
  includeTime: boolean;
  range: boolean;
  start: WallClock | null;
  end: WallClock | null;
};

export const EMPTY_DRAFT: ScheduleDraft = {
  includeTime: false,
  range: false,
  start: null,
  end: null,
};

const DEFAULT_TIME = "09:00";

function wallClock(iso: string, timeZone: string): WallClock {
  const local = dayjs(iso).tz(timeZone);
  return { date: local.format("YYYY-MM-DD"), time: local.format("HH:mm") };
}

function instant(value: WallClock, timeZone: string): string {
  return dayjs.tz(`${value.date} ${value.time}`, "YYYY-MM-DD HH:mm", timeZone).toISOString();
}

export function draftFromSchedule(schedule: ScheduleDto | null, timeZone: string): ScheduleDraft {
  if (!schedule) return EMPTY_DRAFT;

  if (schedule.allDay) {
    return {
      includeTime: false,
      range: schedule.from !== null,
      start: schedule.from ? { date: schedule.from, time: DEFAULT_TIME } : null,
      end: { date: schedule.to, time: DEFAULT_TIME },
    };
  }

  return {
    includeTime: true,
    range: schedule.from !== null,
    start: schedule.from ? wallClock(schedule.from, timeZone) : null,
    end: wallClock(schedule.to, timeZone),
  };
}

export function scheduleFromDraft(draft: ScheduleDraft, timeZone: string): ScheduleInputDto | null {
  if (!draft.end) return null;
  const start = draft.range ? draft.start : null;

  if (!draft.includeTime) {
    return { allDay: true, from: start?.date ?? null, to: draft.end.date };
  }

  return {
    allDay: false,
    from: start ? instant(start, timeZone) : null,
    to: instant(draft.end, timeZone),
  };
}

/** Selezione dal calendario: `[giorno, null]` per un punto, `[inizio, fine]` per un intervallo. */
export function setDraftDates(
  draft: ScheduleDraft,
  [first, second]: [string | null, string | null],
): ScheduleDraft {
  if (!first) return { ...draft, start: null, end: null };

  const keep = (current: WallClock | null, date: string): WallClock => ({
    date,
    time: current?.time ?? DEFAULT_TIME,
  });

  if (!draft.range) return { ...draft, start: null, end: keep(draft.end, first) };

  return {
    ...draft,
    start: keep(draft.start, first),
    end: keep(draft.end, second ?? first),
  };
}

/** Accende o spegne l'intervallo: l'inizio parte dal giorno della scadenza. */
export function setDraftRange(draft: ScheduleDraft, range: boolean): ScheduleDraft {
  if (!range) return { ...draft, range: false, start: null };
  return { ...draft, range: true, start: draft.end ? { ...draft.end } : null };
}

export function setDraftIncludeTime(draft: ScheduleDraft, includeTime: boolean): ScheduleDraft {
  return { ...draft, includeTime };
}

export function setDraftTime(
  draft: ScheduleDraft,
  which: "start" | "end",
  time: string,
): ScheduleDraft {
  const current = draft[which];
  if (!current || !/^\d{2}:\d{2}$/.test(time)) return draft;
  return { ...draft, [which]: { ...current, time } };
}

export type DraftViolation = "endBeforeStart";

export function draftViolation(draft: ScheduleDraft): DraftViolation | null {
  if (!draft.range || !draft.start || !draft.end) return null;
  const key = (value: WallClock) =>
    draft.includeTime ? `${value.date} ${value.time}` : value.date;
  return key(draft.start) > key(draft.end) ? "endBeforeStart" : null;
}

function formatPoint(value: WallClock, includeTime: boolean): string {
  const date = dayjs(value.date).format("DD/MM/YYYY");
  return includeTime ? `${date} ${value.time}` : date;
}

/** Testo del trigger: punto o intervallo; lo stesso giorno non si ripete. */
export function formatDraft(draft: ScheduleDraft): string | null {
  if (!draft.end) return null;
  if (!draft.range || !draft.start) return formatPoint(draft.end, draft.includeTime);

  const sameDay = draft.start.date === draft.end.date;
  const end =
    sameDay && draft.includeTime ? draft.end.time : formatPoint(draft.end, draft.includeTime);
  return `${formatPoint(draft.start, draft.includeTime)} → ${end}`;
}

/**
 * Ritardo derivato (ADR-0004), come `temporalState` del core: un all-day scade
 * alla fine del suo giorno nella timezone del task, un timed appena passa `to`.
 */
export function isLate(schedule: ScheduleDto | null, status: string, now: Date): boolean {
  if (!schedule || (status !== "open" && status !== "in_progress")) return false;
  if (schedule.allDay) return dayjs(now).tz(schedule.timeZone).format("YYYY-MM-DD") > schedule.to;
  return now.getTime() > new Date(schedule.to).getTime();
}

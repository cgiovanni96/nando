import type { DomainError, Result } from "@nando/kernel";
import { err, ok } from "@nando/kernel";

/** Data locale `YYYY-MM-DD`, senza ora né timezone. */
export type LocalDate = string;

/**
 * Value object del tempo di un'occorrenza (ADR-0004). `allDay` decide il tipo
 * di `from` e `to`: date locali nella timezone del Task, oppure istanti UTC.
 * `to` è la scadenza; `from` presente indica un intervallo.
 */
export type Schedule =
  | { allDay: true; from: LocalDate | null; to: LocalDate; timeZone: string }
  | { allDay: false; from: Date | null; to: Date; timeZone: string };

/** Schedule come arriva da un comando: stringhe, timezone presa dal Task. */
export type ScheduleInput = {
  allDay: boolean;
  from: string | null;
  to: string;
};

/** Stato temporale derivato (ADR-0004); mai memorizzato. */
export type TemporalState = "upcoming" | "current" | "overdue";

const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ACTIVE_STATUSES = new Set(["open", "in_progress"]);

export function isValidTimeZone(timeZone: string): boolean {
  if (!timeZone) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

function isLocalDate(value: string): boolean {
  if (!LOCAL_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function parseInstant(value: string): Date | null {
  if (LOCAL_DATE.test(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Giorno di calendario di un istante nella timezone data. */
export function localDate(instant: Date, timeZone: string): LocalDate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function invalid(message: string): DomainError {
  return { code: "validation_error", message };
}

/** Valida l'input e lo trasforma in Schedule nella timezone del Task. */
export function buildSchedule(input: ScheduleInput, timeZone: string): Result<Schedule> {
  if (!isValidTimeZone(timeZone)) return err(invalid("La timezone del task non è valida."));

  if (input.allDay) {
    if (!isLocalDate(input.to) || (input.from !== null && !isLocalDate(input.from))) {
      return err(invalid("Un task di tutto il giorno usa date nel formato AAAA-MM-GG."));
    }
    if (input.from !== null && input.from > input.to) {
      return err(invalid("L'inizio non può essere dopo la scadenza."));
    }
    return ok({ allDay: true, from: input.from, to: input.to, timeZone });
  }

  const to = parseInstant(input.to);
  const from = input.from === null ? null : parseInstant(input.from);
  if (!to || (input.from !== null && !from)) {
    return err(invalid("Un task con orario usa istanti ISO 8601 con ora."));
  }
  if (from && from.getTime() > to.getTime()) {
    return err(invalid("L'inizio non può essere dopo la scadenza."));
  }
  return ok({ allDay: false, from, to, timeZone });
}

/**
 * `upcoming` prima dell'inizio (o della scadenza, se è un punto), `current`
 * dentro l'intervallo, `overdue` dopo la scadenza. Un all-day si confronta per
 * giorno nella timezone del Task: scade alla fine di quel giorno. Le occorrenze
 * chiuse non hanno stato temporale.
 */
export function temporalState(schedule: Schedule, status: string, now: Date): TemporalState | null {
  if (!ACTIVE_STATUSES.has(status)) return null;

  if (schedule.allDay) {
    const today = localDate(now, schedule.timeZone);
    if (today > schedule.to) return "overdue";
    if (schedule.from !== null && schedule.from <= today) return "current";
    return "upcoming";
  }

  const t = now.getTime();
  if (t > schedule.to.getTime()) return "overdue";
  if (schedule.from && schedule.from.getTime() <= t) return "current";
  return "upcoming";
}

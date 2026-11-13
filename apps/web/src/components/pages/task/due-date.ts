import dayjs from "dayjs";

export type DueValue = {
  at: Date | null;
  hasTime: boolean;
};

export const EMPTY_DUE: DueValue = { at: null, hasTime: false };

/** Testo del trigger: la data senza orario quando `hasTime` è falso. */
export function formatDue(value: DueValue): string | null {
  if (!value.at) return null;

  return dayjs(value.at).format(value.hasTime ? "DD/MM/YYYY HH:mm" : "DD/MM/YYYY");
}

/**
 * Seleziona un giorno conservando la modalità corrente. Una data senza orario
 * viene salvata a fine giornata locale, così “in ritardo” scatta dal giorno dopo
 * (ADR-0004). Con l'orario attivo si conserva l'ora già scelta, o 09:00.
 */
export function setDueDate(value: DueValue, date: Date | string | null): DueValue {
  if (!date) return EMPTY_DUE;

  const day = dayjs(date);

  if (!value.hasTime) {
    return { at: day.endOf("day").toDate(), hasTime: false };
  }

  const time = value.at ? dayjs(value.at) : null;

  return {
    at: day
      .hour(time?.hour() ?? 9)
      .minute(time?.minute() ?? 0)
      .second(0)
      .millisecond(0)
      .toDate(),
    hasTime: true,
  };
}

/** Accende o spegne l'orario: spento significa fine giornata locale. */
export function setDueTime(value: DueValue, hasTime: boolean): DueValue {
  if (!value.at) return EMPTY_DUE;

  return hasTime
    ? {
        at: dayjs(value.at).hour(9).minute(0).second(0).millisecond(0).toDate(),
        hasTime: true,
      }
    : { at: dayjs(value.at).endOf("day").toDate(), hasTime: false };
}

/** Scorciatoia “Oggi”: il giorno corrente, stessa modalità e stesso orario. */
export function withToday(value: DueValue, now: Date): DueValue {
  return setDueDate(value, now);
}

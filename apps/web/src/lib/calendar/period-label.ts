import { formatLocalDate } from "@web/lib/format/datetime";
import { defaultLocale } from "@web/lib/i18n/config";

import type { CalendarView } from "./agenda-event";
import { viewRange } from "./agenda-event";

const monthFormatter = new Intl.DateTimeFormat(defaultLocale, {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** Etichetta italiana del periodo mostrato: mese, giorno o intervallo di giorni. */
export function periodLabel(view: CalendarView, date: string): string {
  if (view === "month") {
    return monthFormatter.format(new Date(`${date.slice(0, 7)}-01T00:00:00Z`));
  }

  if (view === "day") {
    return formatLocalDate(date, "long");
  }

  const { from, to } = viewRange(view, date);
  const fromYear = from.slice(0, 4);
  const toYear = to.slice(0, 4);

  return fromYear === toYear
    ? `${formatLocalDate(from, "short")} – ${formatLocalDate(to, "short")} ${toYear}`
    : `${formatLocalDate(from, "short")} ${fromYear} – ${formatLocalDate(to, "short")} ${toYear}`;
}

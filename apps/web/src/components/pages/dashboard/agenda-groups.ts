import type { AgendaItem } from "@web/lib/queries/agenda";

/** Righe visibili nel tab Oggi prima di «Mostra tutte». */
export const TODAY_VISIBLE_ROWS = 7;

/** Giorni mostrati nel tab «Prossimi 7 giorni»: da domani a `today + 6`. */
export const NEXT_DAYS = 6;

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** Aritmetica su giorni `YYYY-MM-DD`, sempre in UTC: nessun fuso entra nel calcolo. */
export function addDays(date: string, days: number): string {
  const next = new Date(Date.parse(`${date}T00:00:00Z`) + days * MILLISECONDS_PER_DAY);

  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
}

/** Giorno di calendario locale del browser, `YYYY-MM-DD`. */
export function localToday(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Scadenza più vicina prima, poi gli orari prima delle giornate intere. */
export function compareAgendaItems(a: AgendaItem, b: AgendaItem): number {
  if (a.dueDate !== b.dueDate) {
    return a.dueDate < b.dueDate ? -1 : 1;
  }

  if (a.schedule.allDay !== b.schedule.allDay) {
    return a.schedule.allDay ? 1 : -1;
  }

  if (a.schedule.to !== b.schedule.to) {
    return a.schedule.to < b.schedule.to ? -1 : 1;
  }

  return a.title.localeCompare(b.title);
}

export type TodayGroupKey = "overdue" | "current" | "dueToday";

/** `total` è la dimensione intera del gruppo, anche quando `items` è tagliato. */
export type TodayGroup = { key: TodayGroupKey; total: number; items: AgendaItem[] };

const TODAY_GROUP_KEYS: readonly TodayGroupKey[] = ["overdue", "current", "dueToday"];

function todayGroupKeyOf(item: AgendaItem, today: string): TodayGroupKey | null {
  if (item.temporalState === "overdue") {
    return "overdue";
  }

  if (item.temporalState === "current") {
    return "current";
  }

  if (item.dueDate === today) {
    return "dueToday";
  }

  return null;
}

/**
 * Tab Oggi: ritardi, in svolgimento e scadenze di oggi, sempre nell'ordine dei
 * tre gruppi. Tutto il resto resta fuori.
 */
export function groupToday(
  items: AgendaItem[],
  today: string,
): { groups: TodayGroup[]; total: number } {
  const groups: TodayGroup[] = TODAY_GROUP_KEYS.map((key) => {
    const groupItems = items
      .filter((item) => todayGroupKeyOf(item, today) === key)
      .toSorted(compareAgendaItems);

    return { key, total: groupItems.length, items: groupItems };
  });

  const total = groups.reduce((sum, group) => sum + group.total, 0);

  return { groups, total };
}

/**
 * Taglia le righe visibili di Oggi: il budget scende di gruppo in gruppo e un
 * gruppo rimasto vuoto sparisce.
 */
export function limitGroups(groups: TodayGroup[], limit: number | null): TodayGroup[] {
  if (limit === null) {
    return groups.filter((group) => group.total > 0);
  }

  const limited: TodayGroup[] = [];
  let budget = limit;

  for (const group of groups) {
    if (budget <= 0) {
      break;
    }

    const items = group.items.slice(0, budget);
    budget -= items.length;

    if (items.length > 0) {
      limited.push({ ...group, items });
    }
  }

  return limited;
}

export type DayEntry = { item: AgendaItem; starts: boolean };

export type AgendaDay = { date: string; entries: DayEntry[] };

/**
 * Tab «Prossimi 7 giorni»: i giorni della finestra ci sono sempre, anche
 * vuoti. Un intervallo compare il giorno in cui inizia (`starts: true`) e il
 * giorno in cui scade.
 */
export function groupNextDays(
  items: AgendaItem[],
  today: string,
): { days: AgendaDay[]; total: number } {
  const days: AgendaDay[] = [];

  for (let offset = 1; offset <= NEXT_DAYS; offset += 1) {
    const date = addDays(today, offset);
    const entries: DayEntry[] = [];

    for (const item of items) {
      if (item.startDate !== null && item.startDate !== item.dueDate && item.startDate === date) {
        entries.push({ item, starts: true });
      }

      if (item.dueDate === date) {
        entries.push({ item, starts: false });
      }
    }

    days.push({ date, entries: entries.toSorted((a, b) => compareAgendaItems(a.item, b.item)) });
  }

  const total = days.reduce((sum, day) => sum + day.entries.length, 0);

  return { days, total };
}

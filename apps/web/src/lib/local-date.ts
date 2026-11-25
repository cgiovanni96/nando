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

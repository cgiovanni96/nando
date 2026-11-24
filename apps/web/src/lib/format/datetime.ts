import { defaultLocale } from "@web/lib/i18n/config";

/**
 * Formattazione delle date per l'interfaccia. Il locale viene dal catalogo:
 * un formato non si scrive a mano nel componente.
 */
const dateTimeFormatter = new Intl.DateTimeFormat(defaultLocale, {
  dateStyle: "short",
  timeStyle: "short",
});

const timeFormatter = new Intl.DateTimeFormat(defaultLocale, {
  timeStyle: "short",
});

const longDateFormatter = new Intl.DateTimeFormat(defaultLocale, {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

const shortDateFormatter = new Intl.DateTimeFormat(defaultLocale, {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

export function formatDateTime(value: string): string {
  return dateTimeFormatter.format(new Date(value));
}

export function formatTime(value: string): string {
  return timeFormatter.format(new Date(value));
}

/**
 * Giorno `YYYY-MM-DD` letto come data di calendario: la formattazione in UTC
 * impedisce che il fuso del browser sposti la data di un giorno.
 */
export function formatLocalDate(value: string, style: "long" | "short" = "long"): string {
  const date = new Date(`${value}T00:00:00Z`);

  return (style === "long" ? longDateFormatter : shortDateFormatter).format(date);
}

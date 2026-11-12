import { defaultLocale } from "@web/lib/i18n/config";

/**
 * Formattazione delle date per l'interfaccia. Il locale viene dal catalogo:
 * un formato non si scrive a mano nel componente.
 */
const dateTimeFormatter = new Intl.DateTimeFormat(defaultLocale, {
  dateStyle: "short",
  timeStyle: "short",
});

export function formatDateTime(value: string): string {
  return dateTimeFormatter.format(new Date(value));
}

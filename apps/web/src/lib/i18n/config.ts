/**
 * The UI ships a single locale. Adding one means adding a catalog under
 * `resources/` and listing it here: components never change.
 */
export const defaultLocale = "it" as const;

export const locales = [defaultLocale] as const;

export type Locale = (typeof locales)[number];

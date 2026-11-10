import { createInstance } from "i18next";
import { initReactI18next } from "react-i18next";

import { defaultLocale, locales } from "./config";
import { resources } from "./resources";

/**
 * One instance for the whole app: the catalog is inline and the UI has a single
 * locale, so there is no per-request language to select. With several locales
 * the instance moves to a per-request factory used by the root route.
 */
export const i18n = createInstance();

void i18n.use(initReactI18next).init({
  lng: defaultLocale,
  fallbackLng: defaultLocale,
  supportedLngs: [...locales],
  resources,
  interpolation: { escapeValue: false },
  returnNull: false,
});

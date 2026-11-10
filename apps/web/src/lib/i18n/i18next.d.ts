import "i18next";

import type { it } from "./resources/it";

/**
 * Makes `t("nav.items.dashboard")` fail on a key that is not in the catalog,
 * and makes interpolation variables required.
 */
declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    returnNull: false;
    resources: { translation: typeof it };
  }
}

import type { AppType } from "@nando/api/type";
import { hc } from "hono/client";

import { getWebConfig } from "./config";

export function createServerApiClient() {
  const config = getWebConfig();

  return hc<AppType>(config.API_URL, {
    headers: {
      authorization: `Bearer ${config.INTERNAL_TOKEN}`,
    },
  });
}

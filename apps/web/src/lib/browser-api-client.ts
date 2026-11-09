import type { AppType } from "@nando/api/type";
import { hc } from "hono/client";

/**
 * Client del browser: il token interno non entra mai nel bundle.
 * Le richieste passano dal proxy same-origin `/api/*` di web.
 */
export const browserApiClient = hc<AppType>("");

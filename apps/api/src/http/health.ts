import { sql } from "drizzle-orm";
import { Hono } from "hono";

import { errorEnvelope, successEnvelope } from "./envelope";
import { HttpError } from "./errors";
import type { ApiDeps, ApiEnv } from "./types";

/**
 * Readiness dell'api.
 *
 * È infrastruttura, non contratto: non passa da `describeRoute`, non è nel
 * manifest e non è proxata da `web`. Verifica il database ma non espone
 * dettagli del guasto al chiamante.
 */
export function createHealthRoutes(deps: ApiDeps) {
  return new Hono<ApiEnv>().get("/api/health", async (c) => {
    const requestId = c.get("requestId");

    try {
      await deps.db.execute(sql`select 1`);
      return c.json(successEnvelope({ status: "ok" }), 200);
    } catch {
      return c.json(
        errorEnvelope(
          new HttpError(503, "dependency_unavailable", "Database non disponibile."),
          requestId,
        ),
        503,
      );
    }
  });
}

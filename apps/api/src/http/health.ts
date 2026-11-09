import { sql } from "drizzle-orm";
import { Hono } from "hono";

import { errorEnvelope, successEnvelope } from "./envelope";
import { HttpError } from "./errors";
import type { ApiDeps, ApiEnv } from "./types";

export function createHealthRoutes(deps: ApiDeps) {
  const health = new Hono<ApiEnv>();

  health.get("/api/health", async (c) => {
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

  return health;
}

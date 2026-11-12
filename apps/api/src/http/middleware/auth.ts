import { timingSafeEqual } from "node:crypto";

import { createMiddleware } from "hono/factory";

import { HttpError } from "../errors";
import type { ApiEnv } from "../types";

/**
 * Confronta il bearer interno in tempo costante.
 *
 * Il token non arriva mai dal browser: lo aggiunge il proxy di `web`. Il
 * confronto lungo e `timingSafeEqual` evitano di trasformare il token in un
 * oracolo temporale.
 */
export function internalTokenMatches(header: string | undefined, expected: string): boolean {
  if (!header?.startsWith("Bearer ")) return false;

  const actual = Buffer.from(header.slice("Bearer ".length));
  const wanted = Buffer.from(expected);

  return actual.length === wanted.length && timingSafeEqual(actual, wanted);
}

/**
 * Autenticazione interna dei processi.
 *
 * Un token errato produce 401 `unauthorized`; quello corretto imposta
 * `actorId`, che i comandi usano per l'idempotenza e per l'attribuzione.
 */
export function bearerAuth(expectedToken: string, actorId: string) {
  return createMiddleware<ApiEnv>(async (c, next) => {
    if (!internalTokenMatches(c.req.header("authorization"), expectedToken)) {
      throw new HttpError(401, "unauthorized", "Token interno mancante o errato.");
    }

    c.set("actorId", actorId);
    await next();
  });
}

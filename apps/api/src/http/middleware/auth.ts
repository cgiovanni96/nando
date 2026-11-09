import { timingSafeEqual } from "node:crypto";

import { createMiddleware } from "hono/factory";

import { HttpError } from "../errors";
import type { ApiEnv } from "../types";

export function internalTokenMatches(header: string | undefined, expected: string): boolean {
  if (!header?.startsWith("Bearer ")) return false;

  const actual = Buffer.from(header.slice("Bearer ".length));
  const wanted = Buffer.from(expected);

  return actual.length === wanted.length && timingSafeEqual(actual, wanted);
}

export function bearerAuth(expectedToken: string, actorId: string) {
  return createMiddleware<ApiEnv>(async (c, next) => {
    if (!internalTokenMatches(c.req.header("authorization"), expectedToken)) {
      throw new HttpError(401, "unauthorized", "Token interno mancante o errato.");
    }

    c.set("actorId", actorId);
    await next();
  });
}

import { newId } from "@nando/kernel";
import { createMiddleware } from "hono/factory";
import { z } from "zod";

import type { ApiEnv } from "@api/http/types";

/**
 * Propaga o genera il request id.
 *
 * Un `x-request-id` valido ricevuto dal proxy viene riusato per correlare i
 * log; uno assente o malformato viene sostituito. Il valore torna anche
 * nell'header di risposta e nell'envelope d'errore.
 */
export const requestId = createMiddleware<ApiEnv>(async (c, next) => {
  const incoming = c.req.header("x-request-id");
  const id = incoming && z.uuid().safeParse(incoming).success ? incoming : newId();

  c.set("requestId", id);
  c.header("x-request-id", id);

  await next();
});

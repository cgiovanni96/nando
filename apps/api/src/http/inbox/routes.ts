import type { SpaceModule } from "@nando/core";
import { Hono } from "hono";
import { describeRoute } from "hono-openapi";

import { bearerAuth } from "@api/http/middleware/auth";
import { jsonResponse } from "@api/http/openapi";
import { queryErrorResponses, validateQuery } from "@api/http/route-support";
import type { ApiDeps, ApiEnv } from "@api/http/types";
import { inboxResponseExample, inboxResponseSchema, listInboxQuerySchema } from "./contract";
import { toInboxItemDto } from "./mapper";

const path = "/api/inbox";

/**
 * Route group della vista Inbox: una sola query, autenticata sul path esatto.
 * La lista viene dal modulo Space, ma l'Inbox non è un sotto-resource.
 */
export function createInboxRoutes(deps: ApiDeps, spaces: SpaceModule) {
  const auth = bearerAuth(deps.config.INTERNAL_TOKEN, deps.config.OWNER_USER_ID);

  return new Hono<ApiEnv>().use(path, auth).get(
    path,
    describeRoute({
      tags: ["inbox"],
      summary: "Vista Inbox",
      description:
        "Query senza effetti: restituisce le entità senza Space proprietario, aggregate dalle " +
        "sorgenti registrate dal composition root. L'Inbox è una vista, non uno Space tecnico. " +
        "La paginazione usa `cursor` e `limit` (default 50, massimo 100).",
      responses: {
        200: jsonResponse(
          "Elenco paginato delle entità in Inbox.",
          inboxResponseSchema,
          inboxResponseExample,
        ),
        ...queryErrorResponses,
      },
    }),
    validateQuery(path, listInboxQuerySchema),
    async (c) => {
      const query = c.req.valid("query");
      const result = await spaces.queries.listInbox({
        cursor: query.cursor ?? null,
        limit: query.limit,
      });

      return c.json(
        inboxResponseSchema.parse({
          ok: true,
          data: {
            items: result.items.map(toInboxItemDto),
            nextCursor: result.nextCursor,
          },
        }),
        200,
      );
    },
  );
}

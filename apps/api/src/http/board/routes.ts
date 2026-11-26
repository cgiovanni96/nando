import type { BoardHorizon, TaskModule } from "@nando/core";
import { Hono } from "hono";
import { describeRoute } from "hono-openapi";

import { bearerAuth } from "@api/http/middleware/auth";
import { jsonResponse } from "@api/http/openapi";
import { queryErrorResponses, validateQuery } from "@api/http/route-support";
import type { ApiDeps, ApiEnv } from "@api/http/types";
import {
  boardQuerySchema,
  boardResponseExample,
  boardResponseSchema,
  type BoardQuery,
} from "./contract";
import { toBoardItemDto } from "./mapper";

const path = "/api/board";

/** Orizzonte della query string convertito nei giorni del core. */
const BOARD_HORIZONS_BY_QUERY = {
  "7": 7,
  "15": 15,
  "30": 30,
} as const satisfies Record<NonNullable<BoardQuery["horizon"]>, BoardHorizon>;

/**
 * Route group della vista Board: una sola query, autenticata sul path esatto.
 * La lista viene dal modulo Task, ma la Board è una vista per stato.
 */
export function createBoardRoutes(deps: ApiDeps, tasks: TaskModule) {
  const auth = bearerAuth(deps.config.INTERNAL_TOKEN, deps.config.OWNER_USER_ID);

  return new Hono<ApiEnv>().use(path, auth).get(
    path,
    describeRoute({
      tags: ["board"],
      summary: "Board dei task per stato",
      description:
        "Query senza effetti: restituisce una sola colonna della board per richiesta. " +
        "`status=open` e `status=in_progress` ordinano per data di scadenza crescente, con i " +
        "task senza data in fondo; `status=completed` torna solo i task con un Completion " +
        "negli ultimi 7 giorni, dal più recente. `spaceId` limita a uno Space. Con `horizon` " +
        "(7, 15 o 30 giorni) resta solo la scadenza entro oggi + N − 1 giorni, valutata nella " +
        "timezone del Task: i task scaduti rientrano, quelli senza data sono nascosti; il " +
        "filtro vale per ogni colonna. `skipped` e `cancelled` non tornano mai. Uno `status` " +
        "o un `horizon` fuori elenco è un 400 `validation_error`. La paginazione usa `cursor` " +
        "e `limit` (default 50, massimo 100).",
      responses: {
        200: jsonResponse("Task della colonna.", boardResponseSchema, boardResponseExample),
        ...queryErrorResponses,
      },
    }),
    validateQuery(path, boardQuerySchema),
    async (c) => {
      const query = c.req.valid("query");
      const horizon = query.horizon ? BOARD_HORIZONS_BY_QUERY[query.horizon] : null;
      const result = await tasks.queries.board({
        status: query.status,
        ...(query.spaceId ? { spaceId: query.spaceId } : {}),
        ...(horizon !== null ? { horizon } : {}),
        cursor: query.cursor ?? null,
        limit: query.limit,
      });

      return c.json(
        boardResponseSchema.parse({
          ok: true,
          data: { items: result.items.map(toBoardItemDto), nextCursor: result.nextCursor },
        }),
        200,
      );
    },
  );
}

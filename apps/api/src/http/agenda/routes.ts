import type { TaskModule } from "@nando/core";
import { Hono } from "hono";
import { describeRoute } from "hono-openapi";

import { bearerAuth } from "@api/http/middleware/auth";
import { jsonResponse } from "@api/http/openapi";
import { queryErrorResponses, validateQuery } from "@api/http/route-support";
import type { ApiDeps, ApiEnv } from "@api/http/types";
import { agendaQuerySchema, agendaResponseExample, agendaResponseSchema } from "./contract";
import { toAgendaItemDto } from "./mapper";

const path = "/api/agenda";

/**
 * Route group della vista Agenda: una sola query, autenticata sul path esatto.
 * La lista viene dal modulo Task, ma l'Agenda è una vista trasversale ai giorni.
 */
export function createAgendaRoutes(deps: ApiDeps, tasks: TaskModule) {
  const auth = bearerAuth(deps.config.INTERNAL_TOKEN, deps.config.OWNER_USER_ID);

  return new Hono<ApiEnv>().use(path, auth).get(
    path,
    describeRoute({
      tags: ["agenda"],
      summary: "Agenda per intervallo di giorni",
      description:
        "Query senza effetti: restituisce le occorrenze dei task in stato `open` o " +
        "`in_progress` che hanno uno Schedule con giorni sovrapposti a `from`–`to` " +
        "(estremi inclusi), valutati nella timezone del Task. " +
        "Con `includeOverdue=true` tornano anche le occorrenze scadute ora con data fuori " +
        "dall'intervallo; quelle nell'intervallo tornano sempre. I task senza Schedule non " +
        "compaiono mai. Ogni voce porta `temporalState`, `dueDate` e `startDate` calcolati " +
        "nella timezone del Task. Un `from` dopo `to` o un intervallo oltre 62 giorni, estremi inclusi, è un " +
        "400 `validation_error`. La paginazione usa `cursor` e `limit` (default 50, massimo 100).",
      responses: {
        200: jsonResponse(
          "Occorrenze dell'intervallo.",
          agendaResponseSchema,
          agendaResponseExample,
        ),
        ...queryErrorResponses,
      },
    }),
    validateQuery(path, agendaQuerySchema),
    async (c) => {
      const query = c.req.valid("query");
      const result = await tasks.queries.agenda({
        from: query.from,
        to: query.to,
        includeOverdue: query.includeOverdue === "true",
        cursor: query.cursor ?? null,
        limit: query.limit,
      });

      return c.json(
        agendaResponseSchema.parse({
          ok: true,
          data: { items: result.items.map(toAgendaItemDto), nextCursor: result.nextCursor },
        }),
        200,
      );
    },
  );
}

import type { TaskModule } from "@nando/core";
import { Hono } from "hono";
import { describeRoute } from "hono-openapi";

import { jsonResponse } from "@api/http/openapi";
import { queryErrorResponses, validateQuery } from "@api/http/route-support";
import type { ApiEnv } from "@api/http/types";
import { toTaskDto } from "@api/http/tasks/mapper";
import { listTasksQuerySchema, taskListResponseExample, taskListResponseSchema } from "./contract";

const path = "/api/tasks";

export function createListTasksRoute(tasks: TaskModule) {
  return new Hono<ApiEnv>().get(
    path,
    describeRoute({
      tags: ["tasks"],
      summary: "Elenca i task",
      description:
        "Query senza effetti: restituisce i task ordinati dal più recente. " +
        "`spaceId` filtra per Space proprietario, `status` per stato dell'occorrenza. " +
        "`state` vale `active` (default) o `deleted`: quest'ultimo elenca solo i task " +
        "cancellati ancora dentro la finestra di grazia di 7 giorni. " +
        "La paginazione usa `cursor` e `limit` (default 50, massimo 100).",
      responses: {
        200: jsonResponse(
          "Elenco paginato dei task.",
          taskListResponseSchema,
          taskListResponseExample,
        ),
        ...queryErrorResponses,
      },
    }),
    validateQuery(path, listTasksQuerySchema),
    async (c) => {
      const query = c.req.valid("query");
      const result = await tasks.queries.list({
        cursor: query.cursor ?? null,
        limit: query.limit,
        state: query.state,
        ...(query.spaceId ? { spaceId: query.spaceId } : {}),
        ...(query.status ? { status: query.status } : {}),
      });

      return c.json(
        taskListResponseSchema.parse({
          ok: true,
          data: { items: result.items.map(toTaskDto), nextCursor: result.nextCursor },
        }),
        200,
      );
    },
  );
}

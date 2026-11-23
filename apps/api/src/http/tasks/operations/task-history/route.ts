import type { TaskModule } from "@nando/core";
import { Hono } from "hono";
import { describeRoute } from "hono-openapi";

import { HttpError } from "@api/http/errors";
import { jsonResponse } from "@api/http/openapi";
import { notFoundResponse, queryErrorResponses, validateParam } from "@api/http/route-support";
import type { ApiEnv } from "@api/http/types";
import { taskIdParamsSchema } from "@api/http/tasks/contract/shared";
import { toTaskHistoryDto } from "@api/http/tasks/mapper";
import { taskHistoryResponseExample, taskHistoryResponseSchema } from "./contract";

const path = "/api/tasks/:taskId/history";

export function createTaskHistoryRoute(tasks: TaskModule) {
  return new Hono<ApiEnv>().get(
    path,
    describeRoute({
      tags: ["tasks"],
      summary: "Storico di un task",
      description:
        "Query senza effetti: completamenti, riaperture e chiusura per skip o cancel " +
        "dell'occorrenza, dal più recente. Le riaperture sono rettifiche: il completamento " +
        "annullato resta nell'elenco. Risponde 404 `not_found` se il task non esiste.",
      responses: {
        200: jsonResponse(
          "Storico del task.",
          taskHistoryResponseSchema,
          taskHistoryResponseExample,
        ),
        ...queryErrorResponses,
        404: notFoundResponse("Task inesistente."),
      },
    }),
    validateParam(path, taskIdParamsSchema),
    async (c) => {
      const { taskId } = c.req.valid("param");
      const history = await tasks.queries.history(taskId);

      if (!history) {
        throw new HttpError(404, "not_found", "Task non trovato.");
      }

      return c.json(
        taskHistoryResponseSchema.parse({
          ok: true,
          data: { items: history.map(toTaskHistoryDto) },
        }),
        200,
      );
    },
  );
}

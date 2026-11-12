import type { TaskModule } from "@nando/core";
import { describeRoute } from "hono-openapi";

import { HttpError } from "../../../errors";
import { jsonResponse } from "../../../openapi";
import {
  type ApiRouter,
  notFoundResponse,
  queryErrorResponses,
  validateParam,
} from "../../../route-support";
import { taskIdParamsSchema, taskResponseSchema } from "../../contract/shared";
import { toTaskDto } from "../../mapper";
import { getTaskResponseExample } from "./contract";

const path = "/api/tasks/:taskId";

export function registerGetTaskRoute(router: ApiRouter, tasks: TaskModule) {
  router.get(
    path,
    describeRoute({
      tags: ["tasks"],
      summary: "Legge un task",
      description:
        "Query senza effetti: restituisce un task non cancellato con stato e scadenza " +
        "della sua occorrenza. Risponde 404 `not_found` se il task non esiste.",
      responses: {
        200: jsonResponse("Task trovato.", taskResponseSchema, getTaskResponseExample),
        ...queryErrorResponses,
        404: notFoundResponse("Task assente o cancellato."),
      },
    }),
    validateParam(path, taskIdParamsSchema),
    async (c) => {
      const { taskId } = c.req.valid("param");
      const task = await tasks.queries.get(taskId);

      if (!task) {
        throw new HttpError(404, "not_found", "Task non trovato.");
      }

      return c.json(taskResponseSchema.parse({ ok: true, data: toTaskDto(task) }), 200);
    },
  );
}

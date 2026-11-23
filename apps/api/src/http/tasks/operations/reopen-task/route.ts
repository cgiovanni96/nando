import type { TaskModule } from "@nando/core";
import { Hono } from "hono";
import { describeRoute } from "hono-openapi";

import { unwrapResult } from "@api/http/errors";
import { jsonRequestBody, jsonResponse } from "@api/http/openapi";
import {
  commandErrorResponses,
  commandResponse,
  domainRuleViolationResponse,
  notFoundResponse,
  validateJson,
  validateParam,
} from "@api/http/route-support";
import type { ApiDeps, ApiEnv } from "@api/http/types";
import { taskIdParamsSchema, taskResponseSchema } from "@api/http/tasks/contract/shared";
import { toTaskDto } from "@api/http/tasks/mapper";
import {
  reopenTaskRequestExample,
  reopenTaskRequestSchema,
  reopenedTaskResponseExample,
} from "./contract";

const path = "/api/tasks/:taskId/reopen";

export function createReopenTaskRoute(deps: ApiDeps, tasks: TaskModule) {
  return new Hono<ApiEnv>().post(
    path,
    describeRoute({
      tags: ["tasks"],
      summary: "Riapre un task completato",
      description:
        "Comando idempotente: una Rectification annulla l'ultimo completamento e " +
        "l'occorrenza torna a `to` (`open` di default, oppure `in_progress`). Il completamento " +
        "resta nello storico. Riaprire verso lo stato già corrente restituisce lo stesso " +
        "risultato; un task saltato o cancellato restituisce 422.",
      requestBody: jsonRequestBody(reopenTaskRequestSchema, reopenTaskRequestExample),
      responses: {
        200: jsonResponse(
          "Task riaperto o replay dello stesso comando.",
          taskResponseSchema,
          reopenedTaskResponseExample,
        ),
        ...commandErrorResponses,
        404: notFoundResponse("Task assente o cancellato."),
        422: domainRuleViolationResponse("Si riapre solo un task completato."),
      },
    }),
    validateParam(path, taskIdParamsSchema),
    validateJson(path, reopenTaskRequestSchema),
    async (c) => {
      const { taskId } = c.req.valid("param");
      const payload = c.req.valid("json");

      return commandResponse(c, deps, {
        commandName: "task.reopen",
        commandId: payload.commandId,
        payload: { taskId, to: payload.to },
        responseSchema: taskResponseSchema,
        execute: async (tx) => {
          const result = await tasks.commands.reopen({ taskId, to: payload.to }, tx);
          const reopened = unwrapResult(result);

          return toTaskDto(reopened);
        },
      });
    },
  );
}

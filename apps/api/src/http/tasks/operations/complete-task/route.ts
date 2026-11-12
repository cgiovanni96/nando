import type { TaskModule } from "@nando/core";
import { Hono } from "hono";
import { describeRoute } from "hono-openapi";

import { unwrapResult } from "../../../errors";
import { jsonRequestBody, jsonResponse } from "../../../openapi";
import {
  commandErrorResponses,
  commandResponse,
  domainRuleViolationResponse,
  notFoundResponse,
  validateJson,
  validateParam,
} from "../../../route-support";
import type { ApiDeps, ApiEnv } from "../../../types";
import {
  taskCommandRequestExample,
  taskCommandRequestSchema,
  taskIdParamsSchema,
  taskResponseSchema,
} from "../../contract/shared";
import { toTaskDto } from "../../mapper";
import { completedTaskResponseExample } from "./contract";

const path = "/api/tasks/:taskId/complete";

export function createCompleteTaskRoute(deps: ApiDeps, tasks: TaskModule) {
  return new Hono<ApiEnv>().post(
    path,
    describeRoute({
      tags: ["tasks"],
      summary: "Completa un task",
      description:
        "Comando di intento idempotente: porta l'occorrenza da `open` a `completed`. " +
        "Completare un task già completato restituisce lo stesso risultato; uno stato " +
        "`skipped` o `cancelled` è terminale e restituisce 422.",
      requestBody: jsonRequestBody(taskCommandRequestSchema, taskCommandRequestExample),
      responses: {
        200: jsonResponse(
          "Task completato o replay dello stesso comando.",
          taskResponseSchema,
          completedTaskResponseExample,
        ),
        ...commandErrorResponses,
        404: notFoundResponse("Task assente o cancellato."),
        422: domainRuleViolationResponse("Transizione di stato non ammessa."),
      },
    }),
    validateParam(path, taskIdParamsSchema),
    validateJson(path, taskCommandRequestSchema),
    async (c) => {
      const { taskId } = c.req.valid("param");
      const payload = c.req.valid("json");

      return commandResponse(c, deps, {
        commandName: "task.complete",
        commandId: payload.commandId,
        payload: { taskId },
        responseSchema: taskResponseSchema,
        execute: async (tx) => {
          const result = await tasks.commands.complete({ taskId }, tx);
          const completed = unwrapResult(result);

          return toTaskDto(completed);
        },
      });
    },
  );
}

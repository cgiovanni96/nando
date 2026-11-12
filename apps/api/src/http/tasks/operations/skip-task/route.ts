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
import {
  taskCommandRequestExample,
  taskCommandRequestSchema,
  taskIdParamsSchema,
  taskResponseSchema,
} from "@api/http/tasks/contract/shared";
import { toTaskDto } from "@api/http/tasks/mapper";
import { skippedTaskResponseExample } from "./contract";

const path = "/api/tasks/:taskId/skip";

export function createSkipTaskRoute(deps: ApiDeps, tasks: TaskModule) {
  return new Hono<ApiEnv>().post(
    path,
    describeRoute({
      tags: ["tasks"],
      summary: "Salta un task",
      description:
        "Comando di intento idempotente: porta l'occorrenza da `open` a `skipped`. " +
        "Saltare un task già saltato restituisce lo stesso risultato; uno stato " +
        "`completed` o `cancelled` è terminale e restituisce 422.",
      requestBody: jsonRequestBody(taskCommandRequestSchema, taskCommandRequestExample),
      responses: {
        200: jsonResponse(
          "Task saltato o replay dello stesso comando.",
          taskResponseSchema,
          skippedTaskResponseExample,
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
        commandName: "task.skip",
        commandId: payload.commandId,
        payload: { taskId },
        responseSchema: taskResponseSchema,
        execute: async (tx) => {
          const result = await tasks.commands.skip({ taskId }, tx);
          const skipped = unwrapResult(result);

          return toTaskDto(skipped);
        },
      });
    },
  );
}

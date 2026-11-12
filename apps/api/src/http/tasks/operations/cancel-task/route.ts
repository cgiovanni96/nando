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
import { cancelledTaskResponseExample } from "./contract";

const path = "/api/tasks/:taskId/cancel";

export function createCancelTaskRoute(deps: ApiDeps, tasks: TaskModule) {
  return new Hono<ApiEnv>().post(
    path,
    describeRoute({
      tags: ["tasks"],
      summary: "Cancella un task",
      description:
        "Comando di intento idempotente: porta l'occorrenza da `open` a `cancelled`. " +
        "Cancellare un task già cancellato restituisce lo stesso risultato; uno stato " +
        "`completed` o `skipped` è terminale e restituisce 422. Un task completato si " +
        "rettifica, non si cancella (ADR-0004).",
      requestBody: jsonRequestBody(taskCommandRequestSchema, taskCommandRequestExample),
      responses: {
        200: jsonResponse(
          "Task cancellato o replay dello stesso comando.",
          taskResponseSchema,
          cancelledTaskResponseExample,
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
        commandName: "task.cancel",
        commandId: payload.commandId,
        payload: { taskId },
        responseSchema: taskResponseSchema,
        execute: async (tx) => {
          const result = await tasks.commands.cancel({ taskId }, tx);
          const cancelled = unwrapResult(result);

          return toTaskDto(cancelled);
        },
      });
    },
  );
}

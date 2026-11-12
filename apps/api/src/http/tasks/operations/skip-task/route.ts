import type { TaskModule } from "@nando/core";
import { describeRoute } from "hono-openapi";

import { unwrapResult } from "../../../errors";
import { jsonRequestBody, jsonResponse } from "../../../openapi";
import {
  type ApiRouter,
  commandErrorResponses,
  commandResponse,
  domainRuleViolationResponse,
  notFoundResponse,
  validateJson,
  validateParam,
} from "../../../route-support";
import type { ApiDeps } from "../../../types";
import {
  taskCommandRequestExample,
  taskCommandRequestSchema,
  taskIdParamsSchema,
  taskResponseSchema,
} from "../../contract/shared";
import { toTaskDto } from "../../mapper";
import { skippedTaskResponseExample } from "./contract";

const path = "/api/tasks/:taskId/skip";

export function registerSkipTaskRoute(router: ApiRouter, deps: ApiDeps, tasks: TaskModule) {
  router.post(
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

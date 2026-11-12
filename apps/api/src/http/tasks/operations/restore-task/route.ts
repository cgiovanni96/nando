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
import { restoredTaskResponseExample } from "./contract";

const path = "/api/tasks/:taskId/restore";

export function createRestoreTaskRoute(deps: ApiDeps, tasks: TaskModule) {
  return new Hono<ApiEnv>().post(
    path,
    describeRoute({
      tags: ["tasks"],
      summary: "Ripristina un task cancellato",
      description:
        "Comando idempotente: azzera `deletedAt` e riporta il task nelle viste, se è dentro " +
        "la finestra di grazia di 7 giorni. Un task attivo è un no-op. Oltre la finestra il " +
        "comando restituisce 422; anche uno Space proprietario archiviato o cancellato " +
        "impedisce il rientro con 422. Un task inesistente restituisce 404.",
      requestBody: jsonRequestBody(taskCommandRequestSchema, taskCommandRequestExample),
      responses: {
        200: jsonResponse(
          "Task ripristinato o replay dello stesso comando.",
          taskResponseSchema,
          restoredTaskResponseExample,
        ),
        ...commandErrorResponses,
        404: notFoundResponse("Task inesistente."),
        422: domainRuleViolationResponse("Finestra di grazia scaduta o Space non scrivibile."),
      },
    }),
    validateParam(path, taskIdParamsSchema),
    validateJson(path, taskCommandRequestSchema),
    async (c) => {
      const { taskId } = c.req.valid("param");
      const payload = c.req.valid("json");

      return commandResponse(c, deps, {
        commandName: "task.restore",
        commandId: payload.commandId,
        payload: { taskId },
        responseSchema: taskResponseSchema,
        execute: async (tx) => {
          const result = await tasks.commands.restore({ taskId }, tx);
          const restored = unwrapResult(result);

          return toTaskDto(restored);
        },
      });
    },
  );
}

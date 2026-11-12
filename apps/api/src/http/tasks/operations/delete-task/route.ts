import type { TaskModule } from "@nando/core";
import { Hono } from "hono";
import { describeRoute } from "hono-openapi";

import { unwrapResult } from "@api/http/errors";
import { jsonRequestBody, jsonResponse } from "@api/http/openapi";
import {
  commandErrorResponses,
  commandResponse,
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
import { deletedTaskResponseExample } from "./contract";

const path = "/api/tasks/:taskId/delete";

export function createDeleteTaskRoute(deps: ApiDeps, tasks: TaskModule) {
  return new Hono<ApiEnv>().post(
    path,
    describeRoute({
      tags: ["tasks"],
      summary: "Cancella un task con grazia",
      description:
        "Comando idempotente: scrive `deletedAt` e nasconde il task dalle liste e dagli " +
        "aggregati, senza eliminare righe. Il task resta leggibile per id e ripristinabile " +
        "entro 7 giorni; un task già cancellato restituisce lo stesso risultato. Nessuna " +
        "purge: arriverà con la retention (ADR-0011).",
      requestBody: jsonRequestBody(taskCommandRequestSchema, taskCommandRequestExample),
      responses: {
        200: jsonResponse(
          "Task cancellato o replay dello stesso comando.",
          taskResponseSchema,
          deletedTaskResponseExample,
        ),
        ...commandErrorResponses,
        404: notFoundResponse("Task inesistente."),
      },
    }),
    validateParam(path, taskIdParamsSchema),
    validateJson(path, taskCommandRequestSchema),
    async (c) => {
      const { taskId } = c.req.valid("param");
      const payload = c.req.valid("json");

      return commandResponse(c, deps, {
        commandName: "task.delete",
        commandId: payload.commandId,
        payload: { taskId },
        responseSchema: taskResponseSchema,
        execute: async (tx) => {
          const result = await tasks.commands.delete({ taskId }, tx);
          const deleted = unwrapResult(result);

          return toTaskDto(deleted);
        },
      });
    },
  );
}

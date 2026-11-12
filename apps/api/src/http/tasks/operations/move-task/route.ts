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
  moveTaskRequestExample,
  moveTaskRequestSchema,
  movedTaskResponseExample,
} from "./contract";

const path = "/api/tasks/:taskId/move";

export function createMoveTaskRoute(deps: ApiDeps, tasks: TaskModule) {
  return new Hono<ApiEnv>().post(
    path,
    describeRoute({
      tags: ["tasks"],
      summary: "Sposta un task in uno Space o in Inbox",
      description:
        "Comando idempotente: cambia lo Space proprietario del task. `spaceId: null` lo " +
        "riporta in Inbox. Lo spostamento è la sola scrittura: titolo e scadenza restano " +
        "quelli correnti. Uno Space archiviato o cancellato restituisce 422, un task o uno " +
        "Space inesistente 404, e in nessuno dei due casi viene applicata una scrittura.",
      requestBody: jsonRequestBody(moveTaskRequestSchema, moveTaskRequestExample),
      responses: {
        200: jsonResponse(
          "Task spostato o replay dello stesso comando.",
          taskResponseSchema,
          movedTaskResponseExample,
        ),
        ...commandErrorResponses,
        404: notFoundResponse("Task o Space non trovato."),
        422: domainRuleViolationResponse("Space archiviato in sola lettura."),
      },
    }),
    validateParam(path, taskIdParamsSchema),
    validateJson(path, moveTaskRequestSchema),
    async (c) => {
      const { taskId } = c.req.valid("param");
      const payload = c.req.valid("json");

      return commandResponse(c, deps, {
        commandName: "task.move",
        commandId: payload.commandId,
        payload: { taskId, spaceId: payload.spaceId },
        responseSchema: taskResponseSchema,
        execute: async (tx) => {
          const result = await tasks.commands.move({ taskId, spaceId: payload.spaceId }, tx);
          const moved = unwrapResult(result);

          return toTaskDto(moved);
        },
      });
    },
  );
}

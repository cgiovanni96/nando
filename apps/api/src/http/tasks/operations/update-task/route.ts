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
  versionConflictResponse,
} from "../../../route-support";
import type { ApiDeps, ApiEnv } from "../../../types";
import { taskIdParamsSchema, taskResponseSchema } from "../../contract/shared";
import { toTaskDto } from "../../mapper";
import {
  updateTaskRequestExample,
  updateTaskRequestSchema,
  updatedTaskResponseExample,
} from "./contract";

const path = "/api/tasks/:taskId/update";

export function createUpdateTaskRoute(deps: ApiDeps, tasks: TaskModule) {
  return new Hono<ApiEnv>().post(
    path,
    describeRoute({
      tags: ["tasks"],
      summary: "Aggiorna un task",
      description:
        "Comando idempotente: aggiorna titolo, Space e scadenza con controllo di `version`. " +
        "Un `expectedVersion` superato restituisce 409 `version_conflict` con la versione " +
        "corrente in `details`; nessuna scrittura viene applicata. Lo stesso status 409 vale " +
        "per un `commandId` riusato con un payload diverso.",
      requestBody: jsonRequestBody(updateTaskRequestSchema, updateTaskRequestExample),
      responses: {
        200: jsonResponse(
          "Task aggiornato o replay dello stesso comando.",
          taskResponseSchema,
          updatedTaskResponseExample,
        ),
        ...commandErrorResponses,
        404: notFoundResponse("Task o Space non trovato."),
        409: versionConflictResponse(),
        422: domainRuleViolationResponse("Space archiviato in sola lettura."),
      },
    }),
    validateParam(path, taskIdParamsSchema),
    validateJson(path, updateTaskRequestSchema),
    async (c) => {
      const { taskId } = c.req.valid("param");
      const payload = c.req.valid("json");

      return commandResponse(c, deps, {
        commandName: "task.update",
        commandId: payload.commandId,
        payload: {
          taskId,
          expectedVersion: payload.expectedVersion,
          title: payload.title,
          spaceId: payload.spaceId,
          dueAt: payload.dueAt,
        },
        responseSchema: taskResponseSchema,
        execute: async (tx) => {
          const result = await tasks.commands.update(
            {
              taskId,
              expectedVersion: payload.expectedVersion,
              title: payload.title,
              spaceId: payload.spaceId,
              dueAt: payload.dueAt ? new Date(payload.dueAt) : null,
            },
            tx,
          );
          const updated = unwrapResult(result);

          return toTaskDto(updated);
        },
      });
    },
  );
}

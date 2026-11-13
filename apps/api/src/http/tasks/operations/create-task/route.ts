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
} from "@api/http/route-support";
import type { ApiDeps, ApiEnv } from "@api/http/types";
import { taskResponseExample, taskResponseSchema } from "@api/http/tasks/contract/shared";
import { toTaskDto } from "@api/http/tasks/mapper";
import { createTaskRequestExample, createTaskRequestSchema } from "./contract";

const path = "/api/tasks";

export function createCreateTaskRoute(deps: ApiDeps, tasks: TaskModule) {
  return new Hono<ApiEnv>().post(
    path,
    describeRoute({
      tags: ["tasks"],
      summary: "Crea un task",
      description:
        "Comando idempotente: crea un task con titolo obbligatorio, stato iniziale `open` e " +
        "una sola occorrenza. `spaceId` null significa Inbox; uno Space archiviato è in sola " +
        "lettura. `dueAt` è la scadenza opzionale.",
      requestBody: jsonRequestBody(createTaskRequestSchema, createTaskRequestExample),
      responses: {
        200: jsonResponse(
          "Task creato o replay dello stesso comando.",
          taskResponseSchema,
          taskResponseExample,
        ),
        ...commandErrorResponses,
        404: notFoundResponse("Space non trovato."),
        422: domainRuleViolationResponse("Space archiviato in sola lettura."),
      },
    }),
    validateJson(path, createTaskRequestSchema),
    async (c) => {
      const payload = c.req.valid("json");

      return commandResponse(c, deps, {
        commandName: "task.create",
        commandId: payload.commandId,
        payload: {
          title: payload.title,
          spaceId: payload.spaceId,
          dueAt: payload.dueAt,
          dueAtHasTime: payload.dueAtHasTime,
        },
        responseSchema: taskResponseSchema,
        execute: async (tx) => {
          const result = await tasks.commands.create(
            {
              title: payload.title,
              spaceId: payload.spaceId,
              dueAt: payload.dueAt ? new Date(payload.dueAt) : null,
              dueAtHasTime: payload.dueAtHasTime,
            },
            tx,
          );
          const created = unwrapResult(result);

          return toTaskDto(created);
        },
      });
    },
  );
}

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
} from "../../../route-support";
import type { ApiDeps } from "../../../types";
import { taskResponseExample, taskResponseSchema } from "../../contract/shared";
import { toTaskDto } from "../../mapper";
import { createTaskRequestExample, createTaskRequestSchema } from "./contract";

const path = "/api/tasks";

export function registerCreateTaskRoute(router: ApiRouter, deps: ApiDeps, tasks: TaskModule) {
  router.post(
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
        },
        responseSchema: taskResponseSchema,
        execute: async (tx) => {
          const result = await tasks.commands.create(
            {
              title: payload.title,
              spaceId: payload.spaceId,
              dueAt: payload.dueAt ? new Date(payload.dueAt) : null,
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

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
  startTaskRequestExample,
  startTaskRequestSchema,
  startedTaskResponseExample,
} from "./contract";

const path = "/api/tasks/:taskId/start";

export function createStartTaskRoute(deps: ApiDeps, tasks: TaskModule) {
  return new Hono<ApiEnv>().post(
    path,
    describeRoute({
      tags: ["tasks"],
      summary: "Inizia un task",
      description:
        "Comando di intento idempotente: porta l'occorrenza da `open` a `in_progress` " +
        "(«In corso», ADR-0028). Non crea un Completion. Iniziare un task già in corso " +
        "restituisce lo stesso risultato; uno stato terminale restituisce 422.",
      requestBody: jsonRequestBody(startTaskRequestSchema, startTaskRequestExample),
      responses: {
        200: jsonResponse(
          "Task in corso o replay dello stesso comando.",
          taskResponseSchema,
          startedTaskResponseExample,
        ),
        ...commandErrorResponses,
        404: notFoundResponse("Task assente o cancellato."),
        422: domainRuleViolationResponse("Transizione di stato non ammessa."),
      },
    }),
    validateParam(path, taskIdParamsSchema),
    validateJson(path, startTaskRequestSchema),
    async (c) => {
      const { taskId } = c.req.valid("param");
      const payload = c.req.valid("json");

      return commandResponse(c, deps, {
        commandName: "task.start",
        commandId: payload.commandId,
        payload: { taskId },
        responseSchema: taskResponseSchema,
        execute: async (tx) => {
          const result = await tasks.commands.start({ taskId }, tx);
          const started = unwrapResult(result);

          return toTaskDto(started);
        },
      });
    },
  );
}

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
  markTodoTaskRequestExample,
  markTodoTaskRequestSchema,
  markedTodoTaskResponseExample,
} from "./contract";

const path = "/api/tasks/:taskId/todo";

export function createMarkTodoTaskRoute(deps: ApiDeps, tasks: TaskModule) {
  return new Hono<ApiEnv>().post(
    path,
    describeRoute({
      tags: ["tasks"],
      summary: "Rimette un task da fare",
      description:
        "Comando di intento idempotente: riporta l'occorrenza da `in_progress` a `open`. " +
        "È un cambio dello stato di lavoro: nessun Completion e nessuna rettifica. Un task " +
        "già da fare restituisce lo stesso risultato; uno stato terminale restituisce 422.",
      requestBody: jsonRequestBody(markTodoTaskRequestSchema, markTodoTaskRequestExample),
      responses: {
        200: jsonResponse(
          "Task da fare o replay dello stesso comando.",
          taskResponseSchema,
          markedTodoTaskResponseExample,
        ),
        ...commandErrorResponses,
        404: notFoundResponse("Task assente o cancellato."),
        422: domainRuleViolationResponse("Transizione di stato non ammessa."),
      },
    }),
    validateParam(path, taskIdParamsSchema),
    validateJson(path, markTodoTaskRequestSchema),
    async (c) => {
      const { taskId } = c.req.valid("param");
      const payload = c.req.valid("json");

      return commandResponse(c, deps, {
        commandName: "task.markTodo",
        commandId: payload.commandId,
        payload: { taskId },
        responseSchema: taskResponseSchema,
        execute: async (tx) => {
          const result = await tasks.commands.markTodo({ taskId }, tx);
          const todo = unwrapResult(result);

          return toTaskDto(todo);
        },
      });
    },
  );
}

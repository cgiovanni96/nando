import {
  taskCommandRequestExample,
  taskCommandRequestSchema,
  taskDtoFactory,
  taskResponseSchema,
} from "@api/http/tasks/contract/shared";

export const markTodoTaskRequestSchema = taskCommandRequestSchema;
export const markTodoTaskRequestExample = taskCommandRequestExample;

export const markedTodoTaskResponseExample = taskResponseSchema.parse({
  ok: true,
  data: taskDtoFactory({
    status: "open",
    version: 2,
    updatedAt: "2026-11-12T10:00:00.000Z",
  }),
});

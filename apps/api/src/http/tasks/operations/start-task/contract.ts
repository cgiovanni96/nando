import {
  taskCommandRequestExample,
  taskCommandRequestSchema,
  taskDtoFactory,
  taskResponseSchema,
} from "@api/http/tasks/contract/shared";

export const startTaskRequestSchema = taskCommandRequestSchema;
export const startTaskRequestExample = taskCommandRequestExample;

export const startedTaskResponseExample = taskResponseSchema.parse({
  ok: true,
  data: taskDtoFactory({
    status: "in_progress",
    version: 2,
    updatedAt: "2026-11-12T10:00:00.000Z",
  }),
});

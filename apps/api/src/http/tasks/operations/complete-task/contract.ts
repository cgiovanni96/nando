import { taskDtoFactory, taskResponseSchema } from "@api/http/tasks/contract/shared";

export const completedTaskResponseExample = taskResponseSchema.parse({
  ok: true,
  data: taskDtoFactory({
    status: "completed",
    version: 2,
    updatedAt: "2026-11-12T10:00:00.000Z",
  }),
});

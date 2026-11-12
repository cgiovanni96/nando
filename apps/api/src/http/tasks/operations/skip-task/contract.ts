import { taskDtoFactory, taskResponseSchema } from "../../contract/shared";

export const skippedTaskResponseExample = taskResponseSchema.parse({
  ok: true,
  data: taskDtoFactory({
    status: "skipped",
    version: 2,
    updatedAt: "2026-11-12T10:00:00.000Z",
  }),
});

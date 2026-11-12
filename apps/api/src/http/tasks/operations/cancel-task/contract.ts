import { taskDtoFactory, taskResponseSchema } from "../../contract/shared";

export const cancelledTaskResponseExample = taskResponseSchema.parse({
  ok: true,
  data: taskDtoFactory({
    status: "cancelled",
    version: 2,
    updatedAt: "2026-11-12T10:00:00.000Z",
  }),
});

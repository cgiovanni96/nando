import {
  EXAMPLE_DUE_AT,
  EXAMPLE_TASK_SPACE_ID,
  taskDtoFactory,
  taskResponseSchema,
} from "@api/http/tasks/contract/shared";

export const getTaskResponseExample = taskResponseSchema.parse({
  ok: true,
  data: taskDtoFactory({
    dueAt: EXAMPLE_DUE_AT,
    dueAtHasTime: true,
    spaceId: EXAMPLE_TASK_SPACE_ID,
  }),
});

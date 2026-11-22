import {
  exampleSchedule,
  EXAMPLE_TASK_SPACE_ID,
  taskDtoFactory,
  taskResponseSchema,
} from "@api/http/tasks/contract/shared";

export const getTaskResponseExample = taskResponseSchema.parse({
  ok: true,
  data: taskDtoFactory({
    schedule: exampleSchedule,
    spaceId: EXAMPLE_TASK_SPACE_ID,
  }),
});

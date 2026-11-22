import { z } from "zod";

import { uuidV7Schema } from "@api/http/envelope";
import {
  EXAMPLE_COMMAND_ID,
  EXAMPLE_DUE_AT,
  exampleSchedule,
  scheduleInputSchema,
  taskDtoFactory,
  taskResponseSchema,
  taskTitleSchema,
} from "@api/http/tasks/contract/shared";

export const updateTaskRequestSchema = z.object({
  commandId: uuidV7Schema,
  expectedVersion: z.number().int().positive(),
  title: taskTitleSchema,
  spaceId: z.uuid().nullable(),
  schedule: scheduleInputSchema.nullable(),
});

export type UpdateTaskRequest = z.infer<typeof updateTaskRequestSchema>;

export function updateTaskRequestFactory(
  overrides: Partial<UpdateTaskRequest> = {},
): UpdateTaskRequest {
  return updateTaskRequestSchema.parse({
    commandId: EXAMPLE_COMMAND_ID,
    expectedVersion: 1,
    title: "Comprare il pane e il latte",
    spaceId: null,
    schedule: { allDay: false, from: null, to: EXAMPLE_DUE_AT },
    ...overrides,
  });
}

export const updateTaskRequestExample = updateTaskRequestFactory();

export const updatedTaskResponseExample = taskResponseSchema.parse({
  ok: true,
  data: taskDtoFactory({
    title: "Comprare il pane e il latte",
    schedule: exampleSchedule,
    version: 2,
    updatedAt: "2026-11-12T10:00:00.000Z",
  }),
});

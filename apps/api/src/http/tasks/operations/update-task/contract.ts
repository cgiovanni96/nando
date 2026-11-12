import { z } from "zod";

import { uuidV7Schema } from "@api/http/envelope";
import {
  EXAMPLE_COMMAND_ID,
  EXAMPLE_DUE_AT,
  taskDtoFactory,
  taskResponseSchema,
  taskTitleSchema,
} from "@api/http/tasks/contract/shared";

export const updateTaskRequestSchema = z.object({
  commandId: uuidV7Schema,
  expectedVersion: z.number().int().positive(),
  title: taskTitleSchema,
  spaceId: z.uuid().nullable(),
  dueAt: z.iso.datetime().nullable(),
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
    dueAt: EXAMPLE_DUE_AT,
    ...overrides,
  });
}

export const updateTaskRequestExample = updateTaskRequestFactory();

export const updatedTaskResponseExample = taskResponseSchema.parse({
  ok: true,
  data: taskDtoFactory({
    title: "Comprare il pane e il latte",
    dueAt: EXAMPLE_DUE_AT,
    version: 2,
    updatedAt: "2026-11-12T10:00:00.000Z",
  }),
});

import { TASK_STATUSES, TASK_TITLE_MAX_LENGTH } from "@nando/core";
import { z } from "zod";

import { successEnvelopeSchema, uuidV7Schema } from "@api/http/envelope";

export const EXAMPLE_COMMAND_ID = "0199a4c2-7a10-7000-8000-000000000001";
export const EXAMPLE_TASK_ID = "0199a4c2-7a10-7000-8000-000000000301";
export const EXAMPLE_TASK_SPACE_ID = "0199a4c2-7a10-7000-8000-000000000401";
export const EXAMPLE_TIMESTAMP = "2026-11-12T09:00:00.000Z";
export const EXAMPLE_DUE_AT = "2026-11-12T18:00:00.000Z";

export const taskStatusSchema = z.enum(TASK_STATUSES);
export const taskTitleSchema = z.string().trim().min(1).max(TASK_TITLE_MAX_LENGTH);

export const taskDtoSchema = z.object({
  id: z.uuid(),
  title: z.string().min(1),
  status: taskStatusSchema,
  dueAt: z.iso.datetime().nullable(),
  spaceId: z.uuid().nullable(),
  version: z.number().int().positive(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  deletedAt: z.iso.datetime().nullable(),
  restorableUntil: z.iso.datetime().nullable(),
});

export const taskIdParamsSchema = z.object({
  taskId: z.uuid(),
});

export const taskCommandRequestSchema = z.object({
  commandId: uuidV7Schema,
});

export const taskResponseSchema = successEnvelopeSchema(taskDtoSchema);

export type TaskDto = z.infer<typeof taskDtoSchema>;
export type TaskCommandRequest = z.infer<typeof taskCommandRequestSchema>;

export function taskDtoFactory(overrides: Partial<TaskDto> = {}): TaskDto {
  return taskDtoSchema.parse({
    id: EXAMPLE_TASK_ID,
    title: "Comprare il pane",
    status: "open",
    dueAt: null,
    spaceId: null,
    version: 1,
    createdAt: EXAMPLE_TIMESTAMP,
    updatedAt: EXAMPLE_TIMESTAMP,
    deletedAt: null,
    restorableUntil: null,
    ...overrides,
  });
}

export function taskCommandRequestFactory(
  overrides: Partial<TaskCommandRequest> = {},
): TaskCommandRequest {
  return taskCommandRequestSchema.parse({
    commandId: EXAMPLE_COMMAND_ID,
    ...overrides,
  });
}

export const taskCommandRequestExample = taskCommandRequestFactory();

export const taskResponseExample = taskResponseSchema.parse({
  ok: true,
  data: taskDtoFactory(),
});

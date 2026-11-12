import { z } from "zod";

import { successEnvelopeSchema } from "@api/http/envelope";
import {
  EXAMPLE_DUE_AT,
  EXAMPLE_TASK_SPACE_ID,
  taskDtoFactory,
  taskDtoSchema,
  taskStatusSchema,
} from "@api/http/tasks/contract/shared";

export const listTasksQuerySchema = z.object({
  spaceId: z.uuid().optional(),
  status: taskStatusSchema.optional(),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const taskListDataSchema = z.object({
  items: z.array(taskDtoSchema),
  nextCursor: z.string().nullable(),
});

export const taskListResponseSchema = successEnvelopeSchema(taskListDataSchema);

export const taskListResponseExample = taskListResponseSchema.parse({
  ok: true,
  data: {
    items: [
      taskDtoFactory(),
      taskDtoFactory({
        id: "0199a4c2-7a10-7000-8000-000000000302",
        title: "Prenotare la visita",
        dueAt: EXAMPLE_DUE_AT,
        spaceId: EXAMPLE_TASK_SPACE_ID,
        updatedAt: "2026-11-12T10:00:00.000Z",
      }),
    ],
    nextCursor: null,
  },
});

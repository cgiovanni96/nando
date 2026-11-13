import { z } from "zod";

import { uuidV7Schema } from "@api/http/envelope";
import { EXAMPLE_COMMAND_ID, taskTitleSchema } from "@api/http/tasks/contract/shared";

export const createTaskRequestSchema = z.object({
  commandId: uuidV7Schema,
  title: taskTitleSchema,
  spaceId: z.uuid().nullable(),
  dueAt: z.iso.datetime().nullable(),
  dueAtHasTime: z.boolean(),
});

export type CreateTaskRequest = z.infer<typeof createTaskRequestSchema>;

export function createTaskRequestFactory(
  overrides: Partial<CreateTaskRequest> = {},
): CreateTaskRequest {
  return createTaskRequestSchema.parse({
    commandId: EXAMPLE_COMMAND_ID,
    title: "Comprare il pane",
    spaceId: null,
    dueAt: null,
    dueAtHasTime: false,
    ...overrides,
  });
}

export const createTaskRequestExample = createTaskRequestFactory();

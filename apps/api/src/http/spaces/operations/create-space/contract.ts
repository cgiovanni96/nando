import { z } from "zod";

import { uuidV7Schema } from "../../../envelope";
import { EXAMPLE_COMMAND_ID, spaceKindSchema, spaceNameSchema } from "../../contract/shared";

export const createSpaceRequestSchema = z.object({
  commandId: uuidV7Schema,
  name: spaceNameSchema,
  kind: spaceKindSchema,
  parentId: z.uuid().nullable(),
});

export type CreateSpaceRequest = z.infer<typeof createSpaceRequestSchema>;

export function createSpaceRequestFactory(
  overrides: Partial<CreateSpaceRequest> = {},
): CreateSpaceRequest {
  return createSpaceRequestSchema.parse({
    commandId: EXAMPLE_COMMAND_ID,
    name: "Vita",
    kind: "area",
    parentId: null,
    ...overrides,
  });
}

export const createSpaceRequestExample = createSpaceRequestFactory();

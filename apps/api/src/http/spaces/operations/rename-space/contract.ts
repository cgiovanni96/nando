import { z } from "zod";

import { uuidV7Schema } from "../../../envelope";
import {
  EXAMPLE_COMMAND_ID,
  spaceDtoFactory,
  spaceNameSchema,
  spaceResponseSchema,
} from "../../contract/shared";

export const renameSpaceRequestSchema = z.object({
  commandId: uuidV7Schema,
  name: spaceNameSchema,
});

export type RenameSpaceRequest = z.infer<typeof renameSpaceRequestSchema>;

export function renameSpaceRequestFactory(
  overrides: Partial<RenameSpaceRequest> = {},
): RenameSpaceRequest {
  return renameSpaceRequestSchema.parse({
    commandId: EXAMPLE_COMMAND_ID,
    name: "Vita e salute",
    ...overrides,
  });
}

export const renameSpaceRequestExample = renameSpaceRequestFactory();

export const renamedSpaceResponseExample = spaceResponseSchema.parse({
  ok: true,
  data: spaceDtoFactory({
    name: "Vita e salute",
    version: 2,
    updatedAt: "2026-11-11T16:00:00.000Z",
  }),
});

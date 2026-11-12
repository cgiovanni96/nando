import { z } from "zod";

import { successEnvelopeSchema } from "@api/http/envelope";
import {
  EXAMPLE_CHILD_SPACE_ID,
  EXAMPLE_SPACE_ID,
  spaceDtoFactory,
  spaceDtoSchema,
  spaceKindSchema,
} from "@api/http/spaces/contract/shared";

export const listSpacesQuerySchema = z.object({
  kind: spaceKindSchema.optional(),
  parentId: z.uuid().optional(),
  includeArchived: z.enum(["true", "false"]).default("false"),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const spaceListDataSchema = z.object({
  items: z.array(spaceDtoSchema),
  nextCursor: z.string().nullable(),
});

export const spaceListResponseSchema = successEnvelopeSchema(spaceListDataSchema);

export const spaceListResponseExample = spaceListResponseSchema.parse({
  ok: true,
  data: {
    items: [
      spaceDtoFactory(),
      spaceDtoFactory({
        id: EXAMPLE_CHILD_SPACE_ID,
        name: "Salute",
        kind: "project",
        parentId: EXAMPLE_SPACE_ID,
        updatedAt: "2026-11-11T16:00:00.000Z",
      }),
    ],
    nextCursor: null,
  },
});

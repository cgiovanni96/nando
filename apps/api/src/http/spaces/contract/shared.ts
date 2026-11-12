// Forme wire condivise da tutte le operazioni Space.
//
// Le operazioni aggiungono i propri schemi in `contract.ts`; qui restano solo
// DTO, parametri e comandi che più operazioni usano davvero.

import { SPACE_KINDS } from "@nando/core";
import { z } from "zod";

import { successEnvelopeSchema, uuidV7Schema } from "@api/http/envelope";

export const EXAMPLE_COMMAND_ID = "0199a4c2-7a10-7000-8000-000000000001";
export const EXAMPLE_SPACE_ID = "0199a4c2-7a10-7000-8000-000000000101";
export const EXAMPLE_CHILD_SPACE_ID = "0199a4c2-7a10-7000-8000-000000000102";
export const EXAMPLE_TIMESTAMP = "2026-11-11T15:12:23.109Z";

export const spaceKindSchema = z.enum(SPACE_KINDS);
export const spaceNameSchema = z.string().trim().min(1).max(120);

export const spaceDtoSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  kind: spaceKindSchema,
  parentId: z.uuid().nullable(),
  completedAt: z.iso.datetime().nullable(),
  archivedAt: z.iso.datetime().nullable(),
  version: z.number().int().positive(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const spaceIdParamsSchema = z.object({
  spaceId: z.uuid(),
});

export const spaceCommandRequestSchema = z.object({
  commandId: uuidV7Schema,
});

export const spaceResponseSchema = successEnvelopeSchema(spaceDtoSchema);

export type SpaceDto = z.infer<typeof spaceDtoSchema>;
export type SpaceCommandRequest = z.infer<typeof spaceCommandRequestSchema>;

export function spaceDtoFactory(overrides: Partial<SpaceDto> = {}): SpaceDto {
  return spaceDtoSchema.parse({
    id: EXAMPLE_SPACE_ID,
    name: "Vita",
    kind: "area",
    parentId: null,
    completedAt: null,
    archivedAt: null,
    version: 1,
    createdAt: EXAMPLE_TIMESTAMP,
    updatedAt: EXAMPLE_TIMESTAMP,
    ...overrides,
  });
}

export function spaceCommandRequestFactory(
  overrides: Partial<SpaceCommandRequest> = {},
): SpaceCommandRequest {
  return spaceCommandRequestSchema.parse({
    commandId: EXAMPLE_COMMAND_ID,
    ...overrides,
  });
}

export const spaceCommandRequestExample = spaceCommandRequestFactory();

export const spaceResponseExample = spaceResponseSchema.parse({
  ok: true,
  data: spaceDtoFactory(),
});

import { spaceDtoFactory, spaceResponseSchema } from "../../contract/shared";

export const archivedSpaceResponseExample = spaceResponseSchema.parse({
  ok: true,
  data: spaceDtoFactory({
    archivedAt: "2026-11-11T16:00:00.000Z",
    version: 2,
    updatedAt: "2026-11-11T16:00:00.000Z",
  }),
});

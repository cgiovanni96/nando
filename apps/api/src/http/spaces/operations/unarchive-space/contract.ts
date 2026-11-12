import { spaceDtoFactory, spaceResponseSchema } from "../../contract/shared";

export const unarchivedSpaceResponseExample = spaceResponseSchema.parse({
  ok: true,
  data: spaceDtoFactory({
    version: 3,
    updatedAt: "2026-11-11T16:00:00.000Z",
  }),
});

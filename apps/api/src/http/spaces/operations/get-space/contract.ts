import {
  EXAMPLE_CHILD_SPACE_ID,
  EXAMPLE_SPACE_ID,
  spaceDtoFactory,
  spaceResponseSchema,
} from "../../contract/shared";

export const childSpaceResponseExample = spaceResponseSchema.parse({
  ok: true,
  data: spaceDtoFactory({
    id: EXAMPLE_CHILD_SPACE_ID,
    name: "Salute",
    kind: "project",
    parentId: EXAMPLE_SPACE_ID,
    version: 2,
    updatedAt: "2026-11-11T16:00:00.000Z",
  }),
});

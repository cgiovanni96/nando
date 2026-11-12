// Superficie pubblica del contratto del gruppo Space.
//
// I contract delle operazioni importano `./shared`, mai questo barrel, così
// non si creano cicli. Test, esempi e strumenti importano da qui.

export {
  EXAMPLE_CHILD_SPACE_ID,
  EXAMPLE_COMMAND_ID,
  EXAMPLE_SPACE_ID,
  EXAMPLE_TIMESTAMP,
  spaceCommandRequestExample,
  spaceCommandRequestFactory,
  spaceCommandRequestSchema,
  spaceDtoFactory,
  spaceDtoSchema,
  spaceIdParamsSchema,
  spaceKindSchema,
  spaceNameSchema,
  spaceResponseExample,
  spaceResponseSchema,
  type SpaceCommandRequest,
  type SpaceDto,
} from "./shared";
export {
  listSpacesQuerySchema,
  spaceListDataSchema,
  spaceListResponseExample,
  spaceListResponseSchema,
} from "@api/http/spaces/operations/list-spaces/contract";
export { childSpaceResponseExample } from "@api/http/spaces/operations/get-space/contract";
export {
  createSpaceRequestExample,
  createSpaceRequestFactory,
  createSpaceRequestSchema,
  type CreateSpaceRequest,
} from "@api/http/spaces/operations/create-space/contract";
export {
  renameSpaceRequestExample,
  renameSpaceRequestFactory,
  renameSpaceRequestSchema,
  renamedSpaceResponseExample,
  type RenameSpaceRequest,
} from "@api/http/spaces/operations/rename-space/contract";
export { archivedSpaceResponseExample } from "@api/http/spaces/operations/archive-space/contract";
export { unarchivedSpaceResponseExample } from "@api/http/spaces/operations/unarchive-space/contract";

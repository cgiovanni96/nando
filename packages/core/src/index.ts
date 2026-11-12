export { person } from "./db/schema/person";
export {
  canContain,
  mutationViolation,
  nameViolation,
  normalizeSpaceName,
  parentViolation,
  spaceStatus,
  SPACE_KINDS,
  SPACE_NAME_MAX_LENGTH,
  type InboxCursor,
  type InboxItem,
  type Space,
  type SpaceKind,
  type SpaceStatus,
} from "./space/domain";
export { createSpaceModule, type SpaceModule, type SpaceModuleDeps } from "./space/module";
export type { InboxSource, InboxSourceQuery, SpaceDatabase } from "./space/ports";
export { space, spaceKind, type SpaceRow } from "./space/schema";

// Il core arriva con M1 (Space, Task); per ora espone Person e Space.
export const CORE_MODULE = "core" as const;

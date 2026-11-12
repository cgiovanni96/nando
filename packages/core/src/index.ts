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
export {
  dueAtViolation,
  isTerminalStatus,
  normalizeTaskTitle,
  spaceViolation,
  TASK_STATUS_TARGETS,
  TASK_STATUSES,
  TASK_TITLE_MAX_LENGTH,
  titleViolation,
  transitionViolation,
  type Task,
  type TaskSpaceSnapshot,
  type TaskStatus,
  type TaskStatusCommand,
} from "./task/domain";
export { createTaskModule, type TaskModule, type TaskModuleDeps } from "./task/module";
export type { TaskCommandDb, TaskDatabase, TaskSpacePort, TaskTransaction } from "./task/ports";
export { task, taskOccurrence, type TaskOccurrenceRow, type TaskRow } from "./task/schema";

// Il core arriva con M1: Space e Task.
export const CORE_MODULE = "core" as const;

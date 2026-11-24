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
  isTerminalStatus,
  normalizeTaskTitle,
  reopenViolation,
  restorableUntil,
  restoreViolation,
  spaceViolation,
  TASK_DELETION_GRACE_DAYS,
  TASK_STATUS_TARGETS,
  TASK_STATUSES,
  TASK_TITLE_MAX_LENGTH,
  titleViolation,
  transitionViolation,
  type AgendaEntry,
  type Task,
  type TaskHistoryEntry,
  type TaskSpaceSnapshot,
  type TaskStatus,
  type TaskStatusCommand,
} from "./task/domain";
export {
  buildSchedule,
  isValidTimeZone,
  localDate,
  scheduleDueDate,
  scheduleStartDate,
  temporalState,
  type LocalDate,
  type Schedule,
  type ScheduleInput,
  type TemporalState,
} from "./task/schedule";
export type { TaskCompleted, TaskCompletionReverted, TaskEvent } from "./task/events";
export { createTaskModule, type TaskModule, type TaskModuleDeps } from "./task/module";
export type { AgendaFilter } from "./task/queries";
export type { TaskCommandDb, TaskDatabase, TaskSpacePort, TaskTransaction } from "./task/ports";
export {
  task,
  taskCompletion,
  taskOccurrence,
  taskRectification,
  type TaskOccurrenceRow,
  type TaskRow,
} from "./task/schema";

// Il core arriva con M1: Space e Task.
export const CORE_MODULE = "core" as const;

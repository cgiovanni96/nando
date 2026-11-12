// Superficie pubblica del contratto del gruppo Task.
//
// I contract delle operazioni importano `./shared`, mai questo barrel, così
// non si creano cicli. Test, esempi e strumenti importano da qui.

export {
  EXAMPLE_COMMAND_ID,
  EXAMPLE_DUE_AT,
  EXAMPLE_TASK_ID,
  EXAMPLE_TASK_SPACE_ID,
  EXAMPLE_TIMESTAMP,
  taskCommandRequestExample,
  taskCommandRequestFactory,
  taskCommandRequestSchema,
  taskDtoFactory,
  taskDtoSchema,
  taskIdParamsSchema,
  taskResponseExample,
  taskResponseSchema,
  taskStatusSchema,
  taskTitleSchema,
  type TaskCommandRequest,
  type TaskDto,
} from "./shared";
export {
  listTasksQuerySchema,
  taskListDataSchema,
  taskListResponseExample,
  taskListResponseSchema,
} from "@api/http/tasks/operations/list-tasks/contract";
export { getTaskResponseExample } from "@api/http/tasks/operations/get-task/contract";
export {
  createTaskRequestExample,
  createTaskRequestFactory,
  createTaskRequestSchema,
  type CreateTaskRequest,
} from "@api/http/tasks/operations/create-task/contract";
export {
  updateTaskRequestExample,
  updateTaskRequestFactory,
  updateTaskRequestSchema,
  updatedTaskResponseExample,
  type UpdateTaskRequest,
} from "@api/http/tasks/operations/update-task/contract";
export { completedTaskResponseExample } from "@api/http/tasks/operations/complete-task/contract";
export { skippedTaskResponseExample } from "@api/http/tasks/operations/skip-task/contract";
export { cancelledTaskResponseExample } from "@api/http/tasks/operations/cancel-task/contract";
export {
  moveTaskRequestExample,
  moveTaskRequestFactory,
  moveTaskRequestSchema,
  movedTaskResponseExample,
  type MoveTaskRequest,
} from "@api/http/tasks/operations/move-task/contract";
export { deletedTaskResponseExample } from "@api/http/tasks/operations/delete-task/contract";
export { restoredTaskResponseExample } from "@api/http/tasks/operations/restore-task/contract";

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
} from "../operations/list-tasks/contract";
export { getTaskResponseExample } from "../operations/get-task/contract";
export {
  createTaskRequestExample,
  createTaskRequestFactory,
  createTaskRequestSchema,
  type CreateTaskRequest,
} from "../operations/create-task/contract";
export {
  updateTaskRequestExample,
  updateTaskRequestFactory,
  updateTaskRequestSchema,
  updatedTaskResponseExample,
  type UpdateTaskRequest,
} from "../operations/update-task/contract";
export { completedTaskResponseExample } from "../operations/complete-task/contract";
export { skippedTaskResponseExample } from "../operations/skip-task/contract";
export { cancelledTaskResponseExample } from "../operations/cancel-task/contract";

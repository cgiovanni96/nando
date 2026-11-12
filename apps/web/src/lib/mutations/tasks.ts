import { mutationOptions } from "@tanstack/react-query";
import type { InferRequestType } from "hono/client";

import { browserApiClient } from "@web/lib/browser-api-client";

/** Body del comando, derivato dal contract della route: nessuna seconda copia. */
export type CreateTaskInput = InferRequestType<typeof browserApiClient.api.tasks.$post>["json"];

export async function createTask(input: CreateTaskInput) {
  const response = await browserApiClient.api.tasks.$post({ json: input });

  if (!response.ok) {
    throw new Error("capture_failed");
  }

  return response.json();
}

export const createTaskMutationOptions = mutationOptions({
  mutationFn: createTask,
});

/** Body dei comandi che portano solo `commandId`, sempre dal contract. */
type DeleteTaskEndpoint = (typeof browserApiClient.api.tasks)[":taskId"]["delete"]["$post"];
type MoveTaskEndpoint = (typeof browserApiClient.api.tasks)[":taskId"]["move"]["$post"];

export type TaskCommandInput = InferRequestType<DeleteTaskEndpoint>["json"];
export type MoveTaskInput = InferRequestType<MoveTaskEndpoint>["json"];

export async function moveTask({ taskId, input }: { taskId: string; input: MoveTaskInput }) {
  const response = await browserApiClient.api.tasks[":taskId"].move.$post({
    param: { taskId },
    json: input,
  });

  if (!response.ok) {
    throw new Error("task_move_failed");
  }

  return response.json();
}

export const moveTaskMutationOptions = mutationOptions({
  mutationFn: moveTask,
});

export async function deleteTask({ taskId, input }: { taskId: string; input: TaskCommandInput }) {
  const response = await browserApiClient.api.tasks[":taskId"]["delete"].$post({
    param: { taskId },
    json: input,
  });

  if (!response.ok) {
    throw new Error("task_delete_failed");
  }

  return response.json();
}

export const deleteTaskMutationOptions = mutationOptions({
  mutationFn: deleteTask,
});

export async function restoreTask({ taskId, input }: { taskId: string; input: TaskCommandInput }) {
  const response = await browserApiClient.api.tasks[":taskId"].restore.$post({
    param: { taskId },
    json: input,
  });

  if (!response.ok) {
    throw new Error("task_restore_failed");
  }

  return response.json();
}

export const restoreTaskMutationOptions = mutationOptions({
  mutationFn: restoreTask,
});

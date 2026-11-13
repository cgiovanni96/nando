import { mutationOptions } from "@tanstack/react-query";
import type { InferRequestType } from "hono/client";

import { toApiError } from "@web/lib/api-error";
import { browserApiClient } from "@web/lib/browser-api-client";

/** Body del comando, derivato dal contract della route: nessuna seconda copia. */
export type CreateTaskInput = InferRequestType<typeof browserApiClient.api.tasks.$post>["json"];

export async function createTask(input: CreateTaskInput) {
  const response = await browserApiClient.api.tasks.$post({ json: input });

  if (!response.ok) {
    throw await toApiError(response, "Non è stato possibile creare il task.");
  }

  return response.json();
}

export const createTaskMutationOptions = mutationOptions({
  mutationFn: createTask,
});

/** Body dei comandi che portano solo `commandId`, sempre dal contract. */
type DeleteTaskEndpoint = (typeof browserApiClient.api.tasks)[":taskId"]["delete"]["$post"];
type MoveTaskEndpoint = (typeof browserApiClient.api.tasks)[":taskId"]["move"]["$post"];
type UpdateTaskEndpoint = (typeof browserApiClient.api.tasks)[":taskId"]["update"]["$post"];

export type TaskCommandInput = InferRequestType<DeleteTaskEndpoint>["json"];
export type MoveTaskInput = InferRequestType<MoveTaskEndpoint>["json"];
export type UpdateTaskInput = InferRequestType<UpdateTaskEndpoint>["json"];

export async function moveTask({ taskId, input }: { taskId: string; input: MoveTaskInput }) {
  const response = await browserApiClient.api.tasks[":taskId"].move.$post({
    param: { taskId },
    json: input,
  });

  if (!response.ok) {
    throw await toApiError(response, "Non è stato possibile spostare il task.");
  }

  return response.json();
}

export const moveTaskMutationOptions = mutationOptions({
  mutationFn: moveTask,
});

export async function updateTask({ taskId, input }: { taskId: string; input: UpdateTaskInput }) {
  const response = await browserApiClient.api.tasks[":taskId"].update.$post({
    param: { taskId },
    json: input,
  });

  if (!response.ok) {
    throw await toApiError(response, "Non è stato possibile salvare il task.");
  }

  return response.json();
}

export const updateTaskMutationOptions = mutationOptions({
  mutationFn: updateTask,
});

export async function completeTask({ taskId, input }: { taskId: string; input: TaskCommandInput }) {
  const response = await browserApiClient.api.tasks[":taskId"].complete.$post({
    param: { taskId },
    json: input,
  });

  if (!response.ok) {
    throw await toApiError(response, "Non è stato possibile completare il task.");
  }

  return response.json();
}

export const completeTaskMutationOptions = mutationOptions({
  mutationFn: completeTask,
});

export async function skipTask({ taskId, input }: { taskId: string; input: TaskCommandInput }) {
  const response = await browserApiClient.api.tasks[":taskId"].skip.$post({
    param: { taskId },
    json: input,
  });

  if (!response.ok) {
    throw await toApiError(response, "Non è stato possibile saltare il task.");
  }

  return response.json();
}

export const skipTaskMutationOptions = mutationOptions({
  mutationFn: skipTask,
});

export async function cancelTask({ taskId, input }: { taskId: string; input: TaskCommandInput }) {
  const response = await browserApiClient.api.tasks[":taskId"].cancel.$post({
    param: { taskId },
    json: input,
  });

  if (!response.ok) {
    throw await toApiError(response, "Non è stato possibile annullare il task.");
  }

  return response.json();
}

export const cancelTaskMutationOptions = mutationOptions({
  mutationFn: cancelTask,
});

export async function deleteTask({ taskId, input }: { taskId: string; input: TaskCommandInput }) {
  const response = await browserApiClient.api.tasks[":taskId"].delete.$post({
    param: { taskId },
    json: input,
  });

  if (!response.ok) {
    throw await toApiError(response, "Non è stato possibile cancellare il task.");
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
    throw await toApiError(response, "Non è stato possibile ripristinare il task.");
  }

  return response.json();
}

export const restoreTaskMutationOptions = mutationOptions({
  mutationFn: restoreTask,
});

import { notifications } from "@mantine/notifications";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { showCompleteToast } from "@web/components/shared/occurrence/complete-toast";
import { ApiError } from "@web/lib/api-error";
import { newCommandId } from "@web/lib/ids";
import {
  completeTaskMutationOptions,
  markTodoTaskMutationOptions,
  reopenTaskMutationOptions,
  startTaskMutationOptions,
} from "@web/lib/mutations/tasks";
import type { BoardItem, BoardStatus } from "@web/lib/queries/board";
import { boardCommand } from "./board-move";

export type BoardMove = {
  move: (item: Pick<BoardItem, "id" | "status">, to: BoardStatus) => void;
  pending: boolean;
};

/** Stato attivo di provenienza: «Annulla» riapre da dove si era partiti. */
type PreviousStatus = "open" | "in_progress";

function notify(message: string) {
  notifications.show({
    message,
    color: "gray",
    withCloseButton: false,
    p: "sm",
    radius: "sm",
  });
}

export function useBoardMove(): BoardMove {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["tasks"] });
  }

  function notifyError(error: Error) {
    notifications.show({
      message: error instanceof ApiError ? error.message : t("task.actions.error"),
      color: "red",
      withCloseButton: false,
      p: "sm",
      radius: "sm",
    });
  }

  const reopen = useMutation({
    ...reopenTaskMutationOptions,
    onSuccess: () => {
      invalidate();
      notify(t("task.actions.reopened"));
    },
    onError: notifyError,
  });

  const complete = useMutation({
    ...completeTaskMutationOptions,
    onSuccess: () => {
      invalidate();
    },
    onError: notifyError,
  });

  const start = useMutation({
    ...startTaskMutationOptions,
    onSuccess: () => {
      invalidate();
      notify(t("task.actions.started"));
    },
    onError: notifyError,
  });

  const todo = useMutation({
    ...markTodoTaskMutationOptions,
    onSuccess: () => {
      invalidate();
      notify(t("task.actions.todo"));
    },
    onError: notifyError,
  });

  function move(item: Pick<BoardItem, "id" | "status">, to: BoardStatus) {
    const { status } = item;

    if (status !== "open" && status !== "in_progress" && status !== "completed") return;

    const command = boardCommand(status, to);

    if (command === null) return;

    switch (command.kind) {
      case "complete": {
        // Ogni card ricorda il proprio stato: «Annulla» riapre questo task, non l'ultimo spostato.
        const previous: PreviousStatus = status === "in_progress" ? "in_progress" : "open";
        complete.mutate(
          { taskId: item.id, input: { commandId: newCommandId() } },
          {
            // «Annulla» è una rettifica (ADR-0004): riapre allo stato di prima.
            onSuccess: () => {
              const id = showCompleteToast(() => {
                notifications.hide(id);
                reopen.mutate({
                  taskId: item.id,
                  input: { commandId: newCommandId(), to: previous },
                });
              });
            },
          },
        );
        return;
      }
      case "start":
        start.mutate({ taskId: item.id, input: { commandId: newCommandId() } });
        return;
      case "todo":
        todo.mutate({ taskId: item.id, input: { commandId: newCommandId() } });
        return;
      case "reopen":
        reopen.mutate({ taskId: item.id, input: { commandId: newCommandId(), to: command.to } });
        return;
    }
  }

  return {
    move,
    pending: complete.isPending || reopen.isPending || start.isPending || todo.isPending,
  };
}

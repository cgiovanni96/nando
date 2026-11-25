import { notifications } from "@mantine/notifications";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiError } from "@web/lib/api-error";
import { newCommandId } from "@web/lib/ids";
import {
  completeTaskMutationOptions,
  reopenTaskMutationOptions,
  skipTaskMutationOptions,
  startTaskMutationOptions,
} from "@web/lib/mutations/tasks";
import type { AgendaItem } from "@web/lib/queries/agenda";
import { showCompleteToast } from "./complete-toast";

export type OccurrenceActions = {
  complete: () => void;
  start: () => void;
  skip: () => void;
  pending: boolean;
};

export function useOccurrenceActions(item: Pick<AgendaItem, "id" | "status">): OccurrenceActions {
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
      notifications.show({
        message: t("task.actions.reopened"),
        color: "gray",
        withCloseButton: false,
        p: "sm",
        radius: "sm",
      });
    },
    onError: notifyError,
  });

  const complete = useMutation({
    ...completeTaskMutationOptions,
    // «Annulla» è una rettifica (ADR-0004): riapre allo stato di prima.
    onSuccess: () => {
      invalidate();
      const previous = item.status === "in_progress" ? "in_progress" : "open";
      const id = showCompleteToast(() => {
        notifications.hide(id);
        reopen.mutate({
          taskId: item.id,
          input: { commandId: newCommandId(), to: previous },
        });
      });
    },
    onError: notifyError,
  });

  const skip = useMutation({
    ...skipTaskMutationOptions,
    onSuccess: () => {
      invalidate();
      notifications.show({
        message: t("task.actions.skipped"),
        color: "gray",
        withCloseButton: false,
        p: "sm",
        radius: "sm",
      });
    },
    onError: notifyError,
  });

  const start = useMutation({
    ...startTaskMutationOptions,
    onSuccess: () => {
      invalidate();
      notifications.show({
        message: t("task.actions.started"),
        color: "gray",
        withCloseButton: false,
        p: "sm",
        radius: "sm",
      });
    },
    onError: notifyError,
  });

  return {
    complete: () => complete.mutate({ taskId: item.id, input: { commandId: newCommandId() } }),
    start: () => start.mutate({ taskId: item.id, input: { commandId: newCommandId() } }),
    skip: () => skip.mutate({ taskId: item.id, input: { commandId: newCommandId() } }),
    pending: complete.isPending || reopen.isPending || skip.isPending || start.isPending,
  };
}

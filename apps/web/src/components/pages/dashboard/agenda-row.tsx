import { ActionIcon, Badge, Button, Checkbox, Group, Menu, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconDots, IconPlayerSkipForward } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiError } from "@web/lib/api-error";
import { formatLocalDate, formatTime } from "@web/lib/format/datetime";
import { newCommandId } from "@web/lib/ids";
import {
  completeTaskMutationOptions,
  reopenTaskMutationOptions,
  skipTaskMutationOptions,
} from "@web/lib/mutations/tasks";
import type { AgendaItem } from "@web/lib/queries/agenda";
import { localToday } from "./agenda-groups";
import classes from "./agenda-row.module.css";

type AgendaRowProps = {
  item: AgendaItem;
  starts?: boolean;
};

type CompleteToastProps = {
  onUndo: () => void;
};

function CompleteToast({ onUndo }: CompleteToastProps) {
  const { t } = useTranslation();

  return (
    <Group gap="sm" justify="space-between" wrap="nowrap">
      <Text size="sm">{t("task.actions.completed")}</Text>
      <Button size="compact-xs" variant="subtle" onClick={onUndo}>
        {t("task.actions.undo")}
      </Button>
    </Group>
  );
}

function showCompleteToast(onUndo: () => void) {
  return notifications.show({
    message: <CompleteToast onUndo={onUndo} />,
    color: "gray",
    withCloseButton: false,
    autoClose: 6000,
    p: "sm",
    radius: "sm",
  });
}

export function AgendaRow({ item, starts = false }: AgendaRowProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["tasks"] });
  }

  function notifyError(error: Error) {
    notifications.show({
      message: error instanceof ApiError ? error.message : t("dashboard.row.error"),
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

  const pending = complete.isPending || reopen.isPending || skip.isPending;
  const today = localToday();
  const dueLabel =
    item.temporalState === "overdue" && item.dueDate !== today
      ? formatLocalDate(item.dueDate, "short")
      : item.schedule.allDay
        ? null
        : formatTime(item.schedule.to);

  return (
    <Group gap="sm" wrap="nowrap" py="xs" className={classes.row}>
      <Checkbox
        onChange={() => complete.mutate({ taskId: item.id, input: { commandId: newCommandId() } })}
        disabled={pending}
        aria-label={t("dashboard.row.complete", { title: item.title })}
      />

      <Link
        to="/tasks/$taskId"
        params={{ taskId: item.id }}
        title={item.title}
        className={`${classes.title} ${classes.link}`}
      >
        {item.title}
      </Link>

      {dueLabel === null ? null : (
        <Text size="xs" c="dimmed">
          {dueLabel}
        </Text>
      )}

      {item.status === "in_progress" ? (
        <Badge variant="light" size="xs" color="gray">
          {t("dashboard.row.inProgress")}
        </Badge>
      ) : null}

      {starts ? (
        <Badge variant="light" size="xs" color="gray">
          {t("dashboard.row.starts")}
        </Badge>
      ) : null}

      <Menu position="bottom-end" withinPortal>
        <Menu.Target>
          <ActionIcon variant="subtle" aria-label={t("dashboard.row.menu", { title: item.title })}>
            <IconDots size={16} stroke={1.6} />
          </ActionIcon>
        </Menu.Target>

        <Menu.Dropdown>
          <Menu.Item
            leftSection={<IconPlayerSkipForward size={16} stroke={1.6} />}
            disabled={pending}
            onClick={() => skip.mutate({ taskId: item.id, input: { commandId: newCommandId() } })}
          >
            {t("task.actions.skip")}
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </Group>
  );
}

import { Group, Paper, Stack, Text } from "@mantine/core";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { UNSCHEDULED_TASK_TYPE } from "@web/lib/calendar/unscheduled-drag";
import type { TaskItem } from "@web/lib/queries/tasks";
import classes from "./unscheduled-panel.module.css";

type UnscheduledItemProps = {
  task: TaskItem;
  spaceLabel: string | null;
  draggable: boolean;
};

export function UnscheduledItem({ task, spaceLabel, draggable }: UnscheduledItemProps) {
  const { t } = useTranslation();
  const inProgress = task.status === "in_progress";

  return (
    <Paper
      withBorder
      p="xs"
      className={classes.item}
      data-draggable={draggable ? "true" : "false"}
      draggable={draggable}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "copy";
        event.dataTransfer.setData(UNSCHEDULED_TASK_TYPE, task.id);
      }}
    >
      <Stack gap={2}>
        <Link
          to="/tasks/$taskId"
          params={{ taskId: task.id }}
          draggable={false}
          className={classes.itemTitle}
        >
          {task.title}
        </Link>

        {spaceLabel !== null || inProgress ? (
          <Group gap="xs" wrap="nowrap">
            {spaceLabel !== null ? (
              <Text size="xs" c="dimmed">
                {spaceLabel}
              </Text>
            ) : null}

            {inProgress ? (
              <Text size="xs" c="dimmed">
                {t("task.status.in_progress")}
              </Text>
            ) : null}
          </Group>
        ) : null}
      </Stack>
    </Paper>
  );
}

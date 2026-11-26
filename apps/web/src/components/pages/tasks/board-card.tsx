import { ActionIcon, Badge, Card, Group, Menu, Stack, Text } from "@mantine/core";
import { IconDots } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { formatLocalDate, formatTime } from "@web/lib/format/datetime";
import { BOARD_COLUMNS } from "@web/lib/queries/board";
import type { BoardItem, BoardStatus } from "@web/lib/queries/board";
import { spaceOptionsQueryOptions } from "@web/lib/queries/spaces";
import classes from "./board-card.module.css";

/** Tipo del trascinamento interno: il JSON distingue la card dal task senza data. */
export const BOARD_TASK_DRAG_TYPE = "application/x-nando-task";

type BoardCardProps = {
  item: BoardItem;
  onMove: (item: Pick<BoardItem, "id" | "status">, to: BoardStatus) => void;
  pending: boolean;
};

export function BoardCard({ item, onMove, pending }: BoardCardProps) {
  const { t } = useTranslation();
  const spaces = useQuery(spaceOptionsQueryOptions);

  const spaceLabel =
    item.spaceId === null
      ? t("task.inboxLabel")
      : (spaces.data?.find((option) => option.value === item.spaceId)?.label ?? null);

  const time =
    item.schedule !== null && !item.schedule.allDay ? formatTime(item.schedule.to) : null;
  const date =
    item.dueDate === null ? t("tasks.card.noDate") : formatLocalDate(item.dueDate, "short");
  const dueLabel = time === null ? date : `${date} ${time}`;

  const otherColumns = BOARD_COLUMNS.filter((status) => status !== item.status);

  return (
    <Card
      withBorder
      padding="sm"
      draggable
      className={classes.card}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData(
          BOARD_TASK_DRAG_TYPE,
          JSON.stringify({ id: item.id, status: item.status }),
        );
      }}
    >
      <Stack gap={4}>
        <Group gap="xs" wrap="nowrap" align="flex-start" justify="space-between">
          <Link
            to="/tasks/$taskId"
            params={{ taskId: item.id }}
            draggable={false}
            className={classes.title}
          >
            {item.title}
          </Link>

          <Menu position="bottom-end" withinPortal>
            <Menu.Target>
              <ActionIcon variant="subtle" aria-label={t("tasks.card.menu", { title: item.title })}>
                <IconDots size={16} stroke={1.6} />
              </ActionIcon>
            </Menu.Target>

            <Menu.Dropdown>
              {otherColumns.map((status) => (
                <Menu.Item
                  key={status}
                  disabled={pending}
                  onClick={() => onMove({ id: item.id, status: item.status }, status)}
                >
                  {t("tasks.card.moveTo", { column: t(`tasks.columns.${status}`) })}
                </Menu.Item>
              ))}
            </Menu.Dropdown>
          </Menu>
        </Group>

        <Group gap="xs" wrap="wrap">
          {spaceLabel === null ? null : (
            <Text size="xs" c="dimmed">
              {spaceLabel}
            </Text>
          )}

          <Text size="xs" c="dimmed">
            {dueLabel}
          </Text>

          {item.temporalState === "overdue" ? (
            <Badge variant="light" size="xs" color="red">
              {t("tasks.card.overdue")}
            </Badge>
          ) : null}

          {item.temporalState === "current" ? (
            <Badge variant="light" size="xs">
              {t("tasks.card.current")}
            </Badge>
          ) : null}
        </Group>
      </Stack>
    </Card>
  );
}

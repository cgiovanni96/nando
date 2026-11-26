import { Alert, Badge, Group, Paper, Skeleton, Stack, Text, Title } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { boardColumnQueryOptions } from "@web/lib/queries/board";
import type { BoardFilter, BoardItem, BoardStatus } from "@web/lib/queries/board";
import { BOARD_TASK_DRAG_TYPE, BoardCard } from "./board-card";
import classes from "./board-column.module.css";

type BoardColumnProps = {
  status: BoardStatus;
  filter: BoardFilter;
  onMove: (item: Pick<BoardItem, "id" | "status">, to: BoardStatus) => void;
  pending: boolean;
};

type BoardDrag = { id: string; status: BoardStatus };

const NO_ITEMS: BoardItem[] = [];
const SKELETONS = [0, 1, 2];

/** Il contenuto del drag è un JSON scritto dalla card; altro si ignora. */
function parseBoardDrag(raw: string): BoardDrag | null {
  let value: unknown;

  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof value !== "object" || value === null) return null;

  const candidate = value as { id?: unknown; status?: unknown };

  if (typeof candidate.id !== "string") return null;

  if (
    candidate.status !== "open" &&
    candidate.status !== "in_progress" &&
    candidate.status !== "completed"
  ) {
    return null;
  }

  return { id: candidate.id, status: candidate.status };
}

export function BoardColumn({ status, filter, onMove, pending }: BoardColumnProps) {
  const { t } = useTranslation();
  const [over, setOver] = useState(false);
  const column = useQuery(boardColumnQueryOptions(status, filter));
  const items = column.data ?? NO_ITEMS;

  return (
    <Paper
      withBorder
      p="sm"
      className={classes.column}
      data-over={over ? "true" : "false"}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes(BOARD_TASK_DRAG_TYPE)) return;

        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        setOver(true);
      }}
      onDragLeave={(event) => {
        const target = event.relatedTarget;

        if (target instanceof Node && event.currentTarget.contains(target)) return;

        setOver(false);
      }}
      onDrop={(event) => {
        setOver(false);

        const drag = parseBoardDrag(event.dataTransfer.getData(BOARD_TASK_DRAG_TYPE));

        if (drag === null || drag.status === status) return;

        event.preventDefault();
        onMove(drag, status);
      }}
    >
      <Stack gap="sm">
        <Group justify="space-between" align="center" wrap="nowrap">
          <Group gap="xs" align="baseline" wrap="nowrap">
            <Title order={2} size="h5">
              {t(`tasks.columns.${status}`)}
            </Title>

            {status === "completed" ? (
              <Text size="xs" c="dimmed">
                {t("tasks.doneWindow")}
              </Text>
            ) : null}
          </Group>

          {column.isSuccess ? (
            <Badge variant="light" size="sm">
              {items.length}
            </Badge>
          ) : null}
        </Group>

        {column.isPending ? (
          <Stack gap="xs">
            {SKELETONS.map((index) => (
              <Skeleton key={index} height={56} radius="sm" aria-label={t("tasks.loading")} />
            ))}
          </Stack>
        ) : null}

        {column.isError ? (
          <Alert color="red" variant="light" p="xs">
            <Text size="sm">{t("tasks.error")}</Text>
          </Alert>
        ) : null}

        {column.isSuccess && items.length === 0 ? (
          <Text c="dimmed" size="sm">
            {t("tasks.empty")}
          </Text>
        ) : null}

        {column.isSuccess && items.length > 0 ? (
          <Stack gap="xs">
            {items.map((item) => (
              <BoardCard key={item.id} item={item} onMove={onMove} pending={pending} />
            ))}
          </Stack>
        ) : null}
      </Stack>
    </Paper>
  );
}

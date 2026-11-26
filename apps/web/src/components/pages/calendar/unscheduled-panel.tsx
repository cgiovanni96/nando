import {
  Badge,
  Center,
  Group,
  Loader,
  Paper,
  ScrollArea,
  Select,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { unscheduledQueryOptions } from "@web/lib/queries/unscheduled";
import { spaceOptionsQueryOptions } from "@web/lib/queries/spaces";
import type { SpaceOption } from "@web/lib/queries/spaces";
import type { TaskItem } from "@web/lib/queries/tasks";
import classes from "./unscheduled-panel.module.css";
import { UnscheduledItem } from "./unscheduled-item";

type UnscheduledPanelProps = {
  canDragTask: (taskId: string) => boolean;
};

// Valori fissi del filtro: nessun UUID coincide con queste stringhe.
const ALL_SPACES = "all";
const INBOX = "inbox";

const NO_TASKS: TaskItem[] = [];
const NO_SPACES: SpaceOption[] = [];

export function UnscheduledPanel({ canDragTask }: UnscheduledPanelProps) {
  const { t } = useTranslation();
  const [space, setSpace] = useState(ALL_SPACES);

  const unscheduled = useQuery(unscheduledQueryOptions);
  const spaces = useQuery(spaceOptionsQueryOptions);

  const tasks = unscheduled.data ?? NO_TASKS;
  const spaceOptions = spaces.data ?? NO_SPACES;

  const spaceNames = useMemo(
    () => new Map(spaceOptions.map((option) => [option.value, option.label] as const)),
    [spaceOptions],
  );

  // Solo gli Space che possiedono almeno un task elencato, nell'ordine delle opzioni.
  const listedSpaces = useMemo(() => {
    const owned = new Set(
      tasks.map((task) => task.spaceId).filter((id): id is string => id !== null),
    );

    return spaceOptions.filter((option) => owned.has(option.value));
  }, [spaceOptions, tasks]);

  const selectData = useMemo<SpaceOption[]>(() => {
    const data: SpaceOption[] = [
      { value: ALL_SPACES, label: t("calendar.unscheduled.allSpaces") },
      { value: INBOX, label: t("calendar.unscheduled.inbox") },
      ...listedSpaces,
    ];

    if (data.some((option) => option.value === space)) {
      return data;
    }

    // La scelta resta finché l'utente non la cambia, anche se non ha più task.
    const current = spaceOptions.find((option) => option.value === space);

    if (current !== undefined) {
      data.push(current);
    }

    return data;
  }, [listedSpaces, space, spaceOptions, t]);

  const visibleTasks = useMemo(() => {
    if (space === ALL_SPACES) {
      return tasks;
    }

    if (space === INBOX) {
      return tasks.filter((task) => task.spaceId === null);
    }

    return tasks.filter((task) => task.spaceId === space);
  }, [space, tasks]);

  function labelFor(task: TaskItem): string | null {
    if (task.spaceId === null) {
      return t("calendar.unscheduled.inbox");
    }

    return spaceNames.get(task.spaceId) ?? null;
  }

  return (
    <Paper
      component="aside"
      withBorder
      p="sm"
      className={classes.panel}
      aria-label={t("calendar.unscheduled.title")}
    >
      <Stack gap="sm">
        <Group justify="space-between" align="center">
          <Title order={2} size="h5">
            {t("calendar.unscheduled.title")}
          </Title>

          {unscheduled.isSuccess ? (
            <Badge variant="light" size="sm">
              {visibleTasks.length}
            </Badge>
          ) : null}
        </Group>

        <Select
          label={t("calendar.unscheduled.space")}
          size="xs"
          clearable={false}
          allowDeselect={false}
          data={selectData}
          value={space}
          onChange={(value) => {
            if (value !== null) setSpace(value);
          }}
        />

        {unscheduled.isPending ? (
          <Center py="lg">
            <Loader size="sm" aria-label={t("calendar.unscheduled.loading")} />
          </Center>
        ) : null}

        {unscheduled.isError ? <Text c="red">{t("calendar.unscheduled.error")}</Text> : null}

        {unscheduled.isSuccess && visibleTasks.length === 0 ? (
          <Text c="dimmed" size="sm">
            {t("calendar.unscheduled.empty")}
          </Text>
        ) : null}

        {unscheduled.isSuccess && visibleTasks.length > 0 ? (
          <ScrollArea.Autosize mah="calc(100dvh - 22rem)">
            <Stack gap="xs">
              {visibleTasks.map((task) => (
                <UnscheduledItem
                  key={task.id}
                  task={task}
                  spaceLabel={labelFor(task)}
                  draggable={canDragTask(task.id)}
                />
              ))}
            </Stack>
          </ScrollArea.Autosize>
        ) : null}
      </Stack>
    </Paper>
  );
}

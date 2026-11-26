import { Group, SegmentedControl, Select, SimpleGrid, Stack, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { BOARD_COLUMNS } from "@web/lib/queries/board";
import type { BoardFilter, BoardHorizon } from "@web/lib/queries/board";
import { spaceOptionsQueryOptions } from "@web/lib/queries/spaces";
import type { SpaceOption } from "@web/lib/queries/spaces";
import { BoardColumn } from "./board-column";
import { useBoardMove } from "./use-board-move";

// Valore fisso del filtro: nessun UUID coincide con questa stringa.
const ALL_SPACES = "all";
const NO_SPACES: SpaceOption[] = [];

function isHorizon(value: string): value is BoardHorizon {
  return value === "all" || value === "7" || value === "15" || value === "30";
}

export function TasksPage() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<BoardFilter>({ spaceId: null, horizon: "all" });
  const { move, pending } = useBoardMove();
  const spaces = useQuery(spaceOptionsQueryOptions);

  const spaceData: SpaceOption[] = [
    { value: ALL_SPACES, label: t("tasks.filters.allSpaces") },
    ...(spaces.data ?? NO_SPACES),
  ];

  const horizonData = [
    { value: "all", label: t("tasks.filters.all") },
    { value: "7", label: t("tasks.filters.days7") },
    { value: "15", label: t("tasks.filters.days15") },
    { value: "30", label: t("tasks.filters.days30") },
  ];

  return (
    <Stack gap="md">
      <Group gap="sm" align="flex-end">
        <Select
          label={t("tasks.filters.space")}
          data={spaceData}
          value={filter.spaceId ?? ALL_SPACES}
          onChange={(value) => {
            setFilter((current) => ({
              ...current,
              spaceId: value === null || value === ALL_SPACES ? null : value,
            }));
          }}
          allowDeselect={false}
          clearable={false}
        />

        <SegmentedControl
          aria-label={t("tasks.filters.horizon")}
          data={horizonData}
          value={filter.horizon}
          onChange={(value) => {
            if (!isHorizon(value)) return;

            setFilter((current) => ({ ...current, horizon: value }));
          }}
        />
      </Group>

      {filter.horizon === "all" ? null : (
        <Text size="xs" c="dimmed">
          {t("tasks.filters.horizonHint")}
        </Text>
      )}

      <SimpleGrid cols={{ base: 1, md: 3 }}>
        {BOARD_COLUMNS.map((status) => (
          <BoardColumn
            key={status}
            status={status}
            filter={filter}
            onMove={move}
            pending={pending}
          />
        ))}
      </SimpleGrid>
    </Stack>
  );
}

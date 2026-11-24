import { EmptyState, Stack, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";

import { formatLocalDate } from "@web/lib/format/datetime";
import type { AgendaDay } from "./agenda-groups";
import { AgendaRow } from "./agenda-row";

type NextDaysPanelProps = {
  days: AgendaDay[];
};

export function NextDaysPanel({ days }: NextDaysPanelProps) {
  const { t } = useTranslation();
  const visibleDays = days.filter((day) => day.entries.length > 0);

  if (visibleDays.length === 0) {
    return <EmptyState title={t("dashboard.next.empty")} />;
  }

  return (
    <Stack gap="md">
      {visibleDays.map((day) => (
        <Stack key={day.date} gap="xs">
          <Text size="xs" fw={600} c="dimmed">
            {formatLocalDate(day.date)}
          </Text>
          <Stack gap={0}>
            {day.entries.map((entry) => (
              <AgendaRow
                key={`${entry.item.id}-${entry.starts ? "start" : "due"}`}
                item={entry.item}
                starts={entry.starts}
              />
            ))}
          </Stack>
        </Stack>
      ))}
    </Stack>
  );
}

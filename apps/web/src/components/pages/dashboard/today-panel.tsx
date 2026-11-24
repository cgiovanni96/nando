import { Button, EmptyState, Group, Stack, Text } from "@mantine/core";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { TODAY_VISIBLE_ROWS, limitGroups, type TodayGroup } from "./agenda-groups";
import { AgendaRow } from "./agenda-row";
import { TodayCapture } from "./today-capture";

type TodayPanelProps = {
  groups: TodayGroup[];
  total: number;
  today: string;
};

export function TodayPanel({ groups, total, today }: TodayPanelProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const visible = limitGroups(groups, expanded ? null : TODAY_VISIBLE_ROWS);

  return (
    <Stack gap="md">
      {total === 0 ? (
        <EmptyState title={t("dashboard.today.empty")} />
      ) : (
        visible.map((group) => (
          <Stack key={group.key} gap="xs">
            <Group gap={6} wrap="nowrap">
              <Text size="xs" fw={600} c="dimmed" tt="uppercase">
                {t(`dashboard.today.groups.${group.key}`)}
              </Text>
              <Text size="xs" c="dimmed">
                {group.total}
              </Text>
            </Group>
            <Stack gap={0}>
              {group.items.map((item) => (
                <AgendaRow key={item.id} item={item} />
              ))}
            </Stack>
          </Stack>
        ))
      )}

      {total > TODAY_VISIBLE_ROWS ? (
        <Button variant="subtle" size="xs" onClick={() => setExpanded(!expanded)}>
          {expanded
            ? t("dashboard.today.showLess")
            : t("dashboard.today.showAll", { count: total })}
        </Button>
      ) : null}

      <TodayCapture today={today} />
    </Stack>
  );
}

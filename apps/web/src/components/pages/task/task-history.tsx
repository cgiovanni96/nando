import { Group, Stack, Text, Timeline, Title } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useTranslation } from "react-i18next";

import { taskHistoryQueryOptions } from "@web/lib/queries/tasks";

type TaskHistoryProps = {
  taskId: string;
};

/**
 * Storico dell'occorrenza (ADR-0004): dal più recente, con le riaperture come
 * voci proprie. Un completamento annullato resta visibile accanto alla sua
 * riapertura.
 */
export function TaskHistory({ taskId }: TaskHistoryProps) {
  const { t } = useTranslation();
  const history = useQuery(taskHistoryQueryOptions(taskId));

  return (
    <Stack gap="xs">
      <Title order={2} size="h5">
        {t("task.history.title")}
      </Title>

      {history.isError ? (
        <Text size="sm" c="red">
          {t("task.history.error")}
        </Text>
      ) : history.data && history.data.length === 0 ? (
        <Text size="sm" c="dimmed">
          {t("task.history.empty")}
        </Text>
      ) : (
        <Timeline active={-1} bulletSize={10} lineWidth={1}>
          {(history.data ?? []).map((entry) => (
            <Timeline.Item key={`${entry.kind}-${entry.at}`}>
              <Group gap="xs" justify="space-between" wrap="nowrap">
                <Text size="sm">{t(`task.history.kind.${entry.kind}`)}</Text>
                <Text size="xs" c="dimmed">
                  {dayjs(entry.at).format("DD/MM/YYYY HH:mm")}
                </Text>
              </Group>
            </Timeline.Item>
          ))}
        </Timeline>
      )}
    </Stack>
  );
}

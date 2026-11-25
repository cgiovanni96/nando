import { Badge, Button, Group, Stack, Text } from "@mantine/core";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { useOccurrenceActions } from "@web/components/shared/occurrence/use-occurrence-actions";
import { formatScheduleLabel } from "@web/lib/format/schedule";
import type { AgendaItem } from "@web/lib/queries/agenda";
import classes from "./occurrence-popover.module.css";

type OccurrenceCardProps = {
  item: AgendaItem;
  onClose: () => void;
};

// Ritardo prima dello stato (ADR-0004); un `open` in orario non mostra nulla.
const STATUS_LABELS = {
  open: null,
  in_progress: "task.status.in_progress",
  completed: "task.status.completed",
  skipped: "task.status.skipped",
  cancelled: "task.status.cancelled",
} as const;

function statusLabel(item: AgendaItem) {
  if (item.temporalState === "overdue") {
    return "task.status.late" as const;
  }

  return STATUS_LABELS[item.status];
}

export function OccurrenceCard({ item, onClose }: OccurrenceCardProps) {
  const { t } = useTranslation();
  const { complete, start, skip, pending } = useOccurrenceActions(item);

  const status = statusLabel(item);
  const active = item.status === "open" || item.status === "in_progress";

  return (
    <Stack gap="xs" p="sm">
      <Stack gap={2}>
        <Text fw={600}>{item.title}</Text>
        <Text size="xs" c="dimmed">
          {formatScheduleLabel(item)}
        </Text>
      </Stack>

      {status === null ? null : (
        <Group gap="xs">
          <Badge variant="light" size="xs" color="gray">
            {t(status)}
          </Badge>
        </Group>
      )}

      <Group gap="xs" wrap="wrap">
        {active ? (
          <>
            <Button
              size="xs"
              variant="filled"
              disabled={pending}
              onClick={() => {
                complete();
                onClose();
              }}
            >
              {t("task.actions.complete")}
            </Button>

            {item.status === "open" ? (
              <Button
                size="xs"
                variant="default"
                disabled={pending}
                onClick={() => {
                  start();
                  onClose();
                }}
              >
                {t("calendar.popover.start")}
              </Button>
            ) : null}

            <Button
              size="xs"
              variant="default"
              disabled={pending}
              onClick={() => {
                skip();
                onClose();
              }}
            >
              {t("task.actions.skip")}
            </Button>
          </>
        ) : null}

        <Link to="/tasks/$taskId" params={{ taskId: item.id }} className={classes.open}>
          {t("calendar.popover.open")}
        </Link>
      </Group>
    </Stack>
  );
}

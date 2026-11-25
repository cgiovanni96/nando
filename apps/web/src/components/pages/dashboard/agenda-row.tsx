import { ActionIcon, Badge, Checkbox, Group, Menu, Text } from "@mantine/core";
import { IconDots, IconPlayerSkipForward } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { useOccurrenceActions } from "@web/components/shared/occurrence/use-occurrence-actions";
import { formatLocalDate, formatTime } from "@web/lib/format/datetime";
import { localToday } from "@web/lib/local-date";
import type { AgendaItem } from "@web/lib/queries/agenda";
import classes from "./agenda-row.module.css";

type AgendaRowProps = {
  item: AgendaItem;
  starts?: boolean;
};

export function AgendaRow({ item, starts = false }: AgendaRowProps) {
  const { t } = useTranslation();
  const { complete, skip, pending } = useOccurrenceActions(item);

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
        onChange={complete}
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
            onClick={skip}
          >
            {t("task.actions.skip")}
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </Group>
  );
}

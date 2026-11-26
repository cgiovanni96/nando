import { ActionIcon, Button, Group, SegmentedControl, Title } from "@mantine/core";
import type { SegmentedControlItem } from "@mantine/core";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

import { shiftDate } from "@web/lib/calendar/agenda-event";
import type { CalendarView } from "@web/lib/calendar/agenda-event";
import { periodLabel } from "@web/lib/calendar/period-label";
import { localToday } from "@web/lib/local-date";
import classes from "./calendar-page.module.css";

type CalendarToolbarProps = {
  view: CalendarView;
  date: string;
  onViewChange: (view: CalendarView) => void;
  onDateChange: (date: string) => void;
  panel?: { opened: boolean; onToggle: () => void };
};

export function CalendarToolbar({
  view,
  date,
  onViewChange,
  onDateChange,
  panel,
}: CalendarToolbarProps) {
  const { t } = useTranslation();

  // Il tipo del valore viene dalle opzioni: niente stringhe arbitrarie da convertire.
  const viewOptions: SegmentedControlItem<CalendarView>[] = [
    { value: "month", label: t("calendar.views.month") },
    { value: "week", label: t("calendar.views.week") },
    { value: "day", label: t("calendar.views.day") },
    { value: "agenda", label: t("calendar.views.agenda") },
  ];

  return (
    <Group justify="space-between" align="center" gap="sm" wrap="wrap">
      <Group align="center" gap="xs" wrap="wrap">
        <ActionIcon
          variant="default"
          aria-label={t("calendar.navigation.previous")}
          onClick={() => {
            onDateChange(shiftDate(view, date, -1));
          }}
        >
          <IconChevronLeft size={18} />
        </ActionIcon>

        <ActionIcon
          variant="default"
          aria-label={t("calendar.navigation.next")}
          onClick={() => {
            onDateChange(shiftDate(view, date, 1));
          }}
        >
          <IconChevronRight size={18} />
        </ActionIcon>

        <Button
          size="xs"
          variant="default"
          onClick={() => {
            onDateChange(localToday());
          }}
        >
          {t("calendar.navigation.today")}
        </Button>

        <Title order={1} size="h3">
          {periodLabel(view, date)}
        </Title>
      </Group>

      <Group gap="xs" wrap="wrap" className={classes.viewControls}>
        {panel === undefined ? null : (
          <Button size="xs" variant="default" aria-expanded={panel.opened} onClick={panel.onToggle}>
            {panel.opened ? t("calendar.unscheduled.hide") : t("calendar.unscheduled.show")}
          </Button>
        )}

        <SegmentedControl
          size="xs"
          value={view}
          onChange={onViewChange}
          data={viewOptions}
          aria-label={t("calendar.views.label")}
          className={classes.views}
        />
      </Group>
    </Group>
  );
}

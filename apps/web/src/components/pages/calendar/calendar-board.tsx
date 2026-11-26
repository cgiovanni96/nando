import { Box, Center, Flex, Loader, Stack, Text } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { toCalendarEvent, viewRange } from "@web/lib/calendar/agenda-event";
import type { CalendarView } from "@web/lib/calendar/agenda-event";
import { planSchedule } from "@web/lib/calendar/schedule-move";
import type { ScheduleInput } from "@web/lib/calendar/schedule-move";
import { localToday } from "@web/lib/local-date";
import type { AgendaItem } from "@web/lib/queries/agenda";
import { calendarQueryOptions } from "@web/lib/queries/calendar";
import { unscheduledQueryOptions } from "@web/lib/queries/unscheduled";
import classes from "./calendar-page.module.css";
import { CalendarToolbar } from "./calendar-toolbar";
import { CalendarViews } from "./calendar-views";
import { OccurrencePopover, type OccurrenceSelection } from "./occurrence-popover";
import { UnscheduledPanel } from "./unscheduled-panel";
import { useReschedule } from "./use-reschedule";

const NO_ITEMS: AgendaItem[] = [];

// `56.25em` è il confine del mock: sotto, un task si sposta dalla sua pagina.
const DRAG_QUERY = "(min-width: 56.25em) and (pointer: fine)";

export function CalendarBoard() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { reschedule, isPending } = useReschedule();
  const canDrag = useMediaQuery(DRAG_QUERY, false, { getInitialValueInEffect: false });
  const [view, setView] = useState<CalendarView>(() =>
    // `47.99em` è il confine `sm` del guscio: sotto, la settimana non sta.
    window.matchMedia("(max-width: 47.99em)").matches ? "agenda" : "week",
  );
  const [date, setDate] = useState(localToday);
  const [selection, setSelection] = useState<OccurrenceSelection | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);

  const calendar = useQuery({
    ...calendarQueryOptions(viewRange(view, date)),
    placeholderData: keepPreviousData,
  });

  const items = calendar.data ?? NO_ITEMS;
  const events = useMemo(() => items.map(toCalendarEvent), [items]);

  const onViewChange = useCallback((next: CalendarView) => {
    setView(next);
    setSelection(null);
  }, []);

  const onDateChange = useCallback((next: string) => {
    setDate(next);
    setSelection(null);
  }, []);

  const onOpenDay = useCallback((day: string) => {
    setDate(day);
    setView("day");
    setSelection(null);
  }, []);

  const onSelect = useCallback((item: AgendaItem, rect: DOMRect) => {
    setSelection({ item, rect });
  }, []);

  const onClose = useCallback(() => {
    setSelection(null);
  }, []);

  const onTogglePanel = useCallback(() => {
    setPanelOpen((open) => !open);
  }, []);

  const canDragItem = useCallback(
    (item: AgendaItem) =>
      (item.status === "open" || item.status === "in_progress") && !isPending(item.id),
    [isPending],
  );

  const canDragTask = useCallback((taskId: string) => !isPending(taskId), [isPending]);

  const onReschedule = useCallback(
    (item: AgendaItem, schedule: ScheduleInput) => {
      setSelection(null);
      reschedule(item, schedule);
    },
    [reschedule],
  );

  const onPlan = useCallback(
    (taskId: string, drop: { dateTime: string; allDay: boolean }) => {
      const tasks = queryClient.getQueryData(unscheduledQueryOptions.queryKey);
      const task = tasks?.find((candidate) => candidate.id === taskId);

      if (task === undefined) return;

      reschedule(task, planSchedule(drop, task.timeZone));
    },
    [queryClient, reschedule],
  );

  const showPanel = view === "week" && canDrag;
  const panel = useMemo(
    () => (showPanel ? { opened: panelOpen, onToggle: onTogglePanel } : undefined),
    [showPanel, panelOpen, onTogglePanel],
  );

  return (
    <Stack gap="md">
      <CalendarToolbar
        view={view}
        date={date}
        onViewChange={onViewChange}
        onDateChange={onDateChange}
        {...(panel === undefined ? {} : { panel })}
      />

      <Flex align="flex-start" gap="md">
        <Box className={classes.viewsColumn}>
          {calendar.isError ? <Text c="red">{t("calendar.error")}</Text> : null}

          {calendar.isPending ? (
            <Center py="xl">
              <Loader aria-label={t("calendar.loading")} />
            </Center>
          ) : null}

          {calendar.isSuccess ? (
            <CalendarViews
              view={view}
              date={date}
              events={events}
              onSelect={onSelect}
              onOpenDay={onOpenDay}
              canDrag={canDrag}
              canDragItem={canDragItem}
              onReschedule={onReschedule}
              onPlan={onPlan}
            />
          ) : null}
        </Box>

        {showPanel && panelOpen ? (
          <Box className={classes.panel}>
            <UnscheduledPanel canDragTask={canDragTask} />
          </Box>
        ) : null}
      </Flex>

      <OccurrencePopover selection={selection} onClose={onClose} />
    </Stack>
  );
}

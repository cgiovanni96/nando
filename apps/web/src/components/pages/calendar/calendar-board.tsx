import { Center, Loader, Stack, Text } from "@mantine/core";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { toCalendarEvent, viewRange } from "@web/lib/calendar/agenda-event";
import type { CalendarView } from "@web/lib/calendar/agenda-event";
import { localToday } from "@web/lib/local-date";
import type { AgendaItem } from "@web/lib/queries/agenda";
import { calendarQueryOptions } from "@web/lib/queries/calendar";
import { CalendarToolbar } from "./calendar-toolbar";
import { CalendarViews } from "./calendar-views";
import { OccurrencePopover, type OccurrenceSelection } from "./occurrence-popover";

const NO_ITEMS: AgendaItem[] = [];

export function CalendarBoard() {
  const { t } = useTranslation();
  const [view, setView] = useState<CalendarView>(() =>
    // `47.99em` è il confine `sm` del guscio: sotto, la settimana non sta.
    window.matchMedia("(max-width: 47.99em)").matches ? "agenda" : "week",
  );
  const [date, setDate] = useState(localToday);
  const [selection, setSelection] = useState<OccurrenceSelection | null>(null);

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

  return (
    <Stack gap="md">
      <CalendarToolbar
        view={view}
        date={date}
        onViewChange={onViewChange}
        onDateChange={onDateChange}
      />

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
        />
      ) : null}

      <OccurrencePopover selection={selection} onClose={onClose} />
    </Stack>
  );
}

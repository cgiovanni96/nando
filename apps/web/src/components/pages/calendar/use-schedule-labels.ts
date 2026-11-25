import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { ScheduleLabelsOverride } from "@mantine/schedule";

/** Le etichette che la libreria stampa da sé, tradotte dal catalogo. */
export function useScheduleLabels(): ScheduleLabelsOverride {
  const { t } = useTranslation();

  return useMemo(
    () => ({
      allDay: t("calendar.allDay"),
      noEvents: t("calendar.empty"),
      more: t("calendar.more"),
      moreLabel: (count: number) => t("calendar.moreCount", { count }),
      weekday: t("calendar.weekday"),
      timeSlot: t("calendar.timeSlot"),
      today: t("calendar.navigation.today"),
      next: t("calendar.navigation.next"),
      previous: t("calendar.navigation.previous"),
      day: t("calendar.views.day"),
      week: t("calendar.views.week"),
      month: t("calendar.views.month"),
      agenda: t("calendar.views.agenda"),
      viewSelectLabel: t("calendar.views.label"),
    }),
    [t],
  );
}

import { createFileRoute } from "@tanstack/react-router";

import { CalendarPage } from "@web/components/pages/calendar/calendar-page";

export const Route = createFileRoute("/calendar")({
  component: CalendarPage,
});

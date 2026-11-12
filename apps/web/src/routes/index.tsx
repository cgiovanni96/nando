import { createFileRoute } from "@tanstack/react-router";

import { DashboardPage } from "@web/components/pages/dashboard/dashboard-page";

export const Route = createFileRoute("/")({
  component: DashboardPage,
});

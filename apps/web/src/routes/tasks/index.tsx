import { createFileRoute } from "@tanstack/react-router";

import { TasksPage } from "@web/components/pages/tasks/tasks-page";

export const Route = createFileRoute("/tasks/")({
  component: TasksPage,
});

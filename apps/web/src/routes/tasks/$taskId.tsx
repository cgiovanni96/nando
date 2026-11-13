import { createFileRoute } from "@tanstack/react-router";

import { TaskPage } from "@web/components/pages/task/task-page";

export const Route = createFileRoute("/tasks/$taskId")({
  component: TaskPage,
});

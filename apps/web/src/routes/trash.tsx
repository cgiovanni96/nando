import { createFileRoute } from "@tanstack/react-router";

import { TrashPage } from "@web/components/pages/trash/trash-page";

export const Route = createFileRoute("/trash")({
  component: TrashPage,
});

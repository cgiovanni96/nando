import { createFileRoute } from "@tanstack/react-router";

import { InboxPage } from "@web/components/pages/inbox/inbox-page";

export const Route = createFileRoute("/inbox")({
  component: InboxPage,
});

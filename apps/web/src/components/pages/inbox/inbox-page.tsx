import { Stack, Title } from "@mantine/core";
import { useTranslation } from "react-i18next";

import { InboxList } from "./inbox-list";

export function InboxPage() {
  const { t } = useTranslation();

  return (
    <Stack gap="xl">
      <Title order={1}>{t("inbox.title")}</Title>
      <InboxList />
    </Stack>
  );
}

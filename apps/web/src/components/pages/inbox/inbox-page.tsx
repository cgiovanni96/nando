import { Stack, Text, Title } from "@mantine/core";
import { useTranslation } from "react-i18next";

import { InboxList } from "./inbox-list";
import { InboxTrash } from "./inbox-trash";

export function InboxPage() {
  const { t } = useTranslation();

  return (
    <Stack gap="xl">
      <Stack gap={8}>
        <Text fz="xs" c="dimmed">
          {t("inbox.eyebrow")}
        </Text>
        <Title order={1}>{t("inbox.title")}</Title>
        <Text c="dimmed" maw={560}>
          {t("inbox.intro")}
        </Text>
      </Stack>

      <InboxList />
      <InboxTrash />
    </Stack>
  );
}

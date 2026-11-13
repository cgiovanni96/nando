import { Anchor, Group, Stack, Title } from "@mantine/core";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { InboxList } from "./inbox-list";

export function InboxPage() {
  const { t } = useTranslation();

  return (
    <Stack gap="xl">
      <Group justify="space-between" align="flex-end" gap="md">
        <Title order={1}>{t("inbox.title")}</Title>
        {/* Finché lo spotlight non esiste, il Cestino resta raggiungibile su mobile. */}
        <Anchor component={Link} to="/trash" size="sm" hiddenFrom="md">
          {t("nav.items.trash")}
        </Anchor>
      </Group>

      <InboxList />
    </Stack>
  );
}

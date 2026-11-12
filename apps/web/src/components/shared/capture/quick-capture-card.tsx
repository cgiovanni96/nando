import { Card, Stack, Text, Title } from "@mantine/core";
import { useTranslation } from "react-i18next";

import { QuickCaptureForm } from "./quick-capture-form";

export function QuickCaptureCard() {
  const { t } = useTranslation();

  return (
    <Card>
      <Stack gap="md">
        <Stack gap={4}>
          <Text fz="xs" c="dimmed">
            {t("capture.eyebrow")}
          </Text>
          <Title order={2}>{t("capture.title")}</Title>
          <Text size="sm" c="dimmed">
            {t("capture.description")}
          </Text>
        </Stack>
        <QuickCaptureForm />
      </Stack>
    </Card>
  );
}

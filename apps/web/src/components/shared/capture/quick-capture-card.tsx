import { Card, Stack, Title } from "@mantine/core";
import { useTranslation } from "react-i18next";

import { QuickCaptureForm } from "./quick-capture-form";

export function QuickCaptureCard() {
  const { t } = useTranslation();

  return (
    <Card>
      <Stack gap="md">
        <Title order={2}>{t("capture.title")}</Title>
        <QuickCaptureForm />
      </Stack>
    </Card>
  );
}

import { Box, Button, Grid, Group, Select, Stack, Text, TextInput } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { useQuickCapture } from "./use-quick-capture";

type QuickCaptureFormProps = {
  layout?: "wide" | "compact";
  autoFocus?: boolean;
  onCreated?: () => void;
};

export function QuickCaptureForm({
  layout = "wide",
  autoFocus = false,
  onCreated,
}: QuickCaptureFormProps) {
  const { t } = useTranslation();
  const titleRef = useRef<HTMLInputElement>(null);
  const { form, spaces, createTask, submit } = useQuickCapture({ onCreated });

  useEffect(() => {
    if (!autoFocus) return;

    // Il focus trap della modale parte prima di questo effetto: il frame
    // successivo riporta il cursore sul titolo del task.
    const frame = requestAnimationFrame(() => titleRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [autoFocus]);

  const titleInput = (
    <TextInput
      {...form.getInputProps("title")}
      ref={titleRef}
      placeholder={t("capture.titlePlaceholder")}
      aria-label={t("capture.titleLabel")}
      leftSection={<IconPlus size={16} stroke={1.6} />}
      disabled={createTask.isPending}
    />
  );

  const spaceSelect = (
    <Select
      {...form.getInputProps("spaceId")}
      data={spaces.data ?? []}
      placeholder={t("capture.spacePlaceholder")}
      aria-label={t("capture.spaceLabel")}
      clearable
      searchable
      loading={spaces.isFetching}
      error={spaces.isError ? t("capture.spacesError") : undefined}
      nothingFoundMessage={t("capture.noSpaces")}
      disabled={createTask.isPending}
    />
  );

  const submitButton = (
    <Button type="submit" variant="filled" loading={createTask.isPending}>
      {t("capture.submit")}
    </Button>
  );

  return (
    <form onSubmit={submit} aria-label={t("capture.title")}>
      <Stack gap="xs">
        {layout === "wide" ? (
          <Grid gap="xs" align="flex-end">
            <Grid.Col span={{ base: 12, sm: 6 }}>{titleInput}</Grid.Col>
            <Grid.Col span={{ base: 8, sm: 4 }}>{spaceSelect}</Grid.Col>
            <Grid.Col span={{ base: 4, sm: 2 }}>{submitButton}</Grid.Col>
          </Grid>
        ) : (
          <Stack gap="xs">
            {titleInput}
            <Group gap="xs" align="flex-end" wrap="nowrap">
              <Box flex={1}>{spaceSelect}</Box>
              {submitButton}
            </Group>
          </Stack>
        )}

        {createTask.isError ? (
          <Text size="xs" c="red" role="alert">
            {t("capture.error")}
          </Text>
        ) : null}
      </Stack>
    </form>
  );
}

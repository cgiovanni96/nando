import { Box, Button, Grid, Group, Select, Stack, Text, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconPlus } from "@tabler/icons-react";
import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { browserApiClient } from "../../../lib/browser-api-client";
import { newCommandId } from "../../../lib/ids";
import { loadSpaceOptions, type SpaceOption } from "../../../lib/spaces";

type QuickCaptureFormProps = {
  layout?: "wide" | "compact";
  autoFocus?: boolean;
  onCreated?: () => void;
};

type Feedback = "success" | "error" | "emptyTitle" | null;

export function QuickCaptureForm({
  layout = "wide",
  autoFocus = false,
  onCreated,
}: QuickCaptureFormProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [spaces, setSpaces] = useState<SpaceOption[]>([]);
  const [spacesLoading, setSpacesLoading] = useState(true);
  const [spacesError, setSpacesError] = useState(false);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const commandId = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;

    loadSpaceOptions()
      .then((options) => {
        if (cancelled) return;
        setSpaces(options);
        setSpacesLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setSpacesError(true);
        setSpacesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function resetIntent() {
    commandId.current = null;
    setFeedback(null);
  }

  function handleTitle(value: string) {
    setTitle(value);
    resetIntent();
  }

  function handleSpace(value: string | null) {
    setSpaceId(value);
    resetIntent();
  }

  async function submit() {
    const trimmed = title.trim();

    if (!trimmed) {
      setFeedback("emptyTitle");
      inputRef.current?.focus();
      return;
    }

    setPending(true);
    setFeedback(null);

    // Stesso commandId finché il payload non cambia: un retry dopo un errore
    // di rete restituisce il risultato già salvato invece di duplicare il task.
    const id = commandId.current ?? newCommandId();
    commandId.current = id;

    try {
      const response = await browserApiClient.api.tasks.$post({
        json: {
          commandId: id,
          title: trimmed,
          spaceId,
          dueAt: null,
        },
      });

      if (!response.ok) {
        setFeedback("error");
        return;
      }

      commandId.current = null;
      setTitle("");
      setFeedback("success");
      inputRef.current?.focus();
      notifications.show({
        message: t("capture.success"),
        color: "gray",
        autoClose: 2000,
        withCloseButton: false,
      });
      onCreated?.();
    } catch {
      setFeedback("error");
    } finally {
      setPending(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit();
  }

  const titleInput = (
    <TextInput
      ref={inputRef}
      autoFocus={autoFocus}
      value={title}
      onChange={(event) => handleTitle(event.currentTarget.value)}
      placeholder={t("capture.titlePlaceholder")}
      aria-label={t("capture.titleLabel")}
      leftSection={<IconPlus size={16} stroke={1.6} />}
      disabled={pending}
    />
  );

  const spaceSelect = (
    <Select
      value={spaceId}
      onChange={handleSpace}
      data={spaces}
      placeholder={t("capture.spacePlaceholder")}
      aria-label={t("capture.spaceLabel")}
      clearable
      searchable
      loading={spacesLoading}
      nothingFoundMessage={t("capture.noSpaces")}
      disabled={pending}
    />
  );

  const submitButton = (
    <Button type="submit" variant="filled" loading={pending}>
      {t("capture.submit")}
    </Button>
  );

  return (
    <form onSubmit={handleSubmit} aria-label={t("capture.title")}>
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

        {spacesError ? (
          <Text size="xs" c="red" role="alert">
            {t("capture.spacesError")}
          </Text>
        ) : null}

        {feedback === "success" ? (
          <Text size="xs" c="dimmed" role="status">
            {t("capture.success")}
          </Text>
        ) : null}

        {feedback === "error" ? (
          <Text size="xs" c="red" role="alert">
            {t("capture.error")}
          </Text>
        ) : null}

        {feedback === "emptyTitle" ? (
          <Text size="xs" c="red" role="alert">
            {t("capture.emptyTitle")}
          </Text>
        ) : null}
      </Stack>
    </form>
  );
}

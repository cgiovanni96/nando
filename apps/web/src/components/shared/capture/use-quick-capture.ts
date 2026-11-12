import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { FormEvent } from "react";
import { useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";

import { newCommandId } from "@web/lib/ids";
import { createTaskMutationOptions, type CreateTaskInput } from "@web/lib/mutations/tasks";
import { spaceOptionsQueryOptions } from "@web/lib/queries/spaces";

export type CaptureValues = Pick<CreateTaskInput, "title" | "spaceId">;

type UseQuickCaptureOptions = {
  onCreated?: (() => void) | undefined;
};

export function useQuickCapture({ onCreated }: UseQuickCaptureOptions) {
  const { t } = useTranslation();
  const commandId = useRef<string | null>(null);
  const isBrowser = typeof window !== "undefined";

  const form = useForm<CaptureValues>({
    initialValues: {
      title: "",
      spaceId: null,
    },
    validate: {
      title: (value) => (value.trim() ? null : t("capture.emptyTitle")),
    },
    onValuesChange: () => {
      commandId.current = null;
    },
  });

  const spaces = useQuery({
    ...spaceOptionsQueryOptions,
    enabled: isBrowser,
  });

  const createTask = useMutation({
    ...createTaskMutationOptions,
    onSuccess: () => {
      commandId.current = null;
      form.setFieldValue("title", "");
      notifications.show({
        message: t("capture.success"),
        color: "gray",
        autoClose: 2000,
        withCloseButton: false,
        p: "sm",
        radius: "sm",
      });
      onCreated?.();
    },
  });

  const submit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const validation = form.validate();
      if (validation.hasErrors) return;

      // Stesso commandId finché il payload non cambia: un retry dopo un errore
      // di rete restituisce il risultato già salvato invece di duplicare il task.
      const id = commandId.current ?? newCommandId();
      commandId.current = id;
      createTask.reset();
      createTask.mutate({
        commandId: id,
        title: form.values.title.trim(),
        spaceId: form.values.spaceId,
        dueAt: null,
      });
    },
    [createTask, form],
  );

  return { form, spaces, createTask, submit };
}

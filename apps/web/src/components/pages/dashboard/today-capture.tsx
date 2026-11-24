import { TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";

import { newCommandId } from "@web/lib/ids";
import { createTaskMutationOptions } from "@web/lib/mutations/tasks";

type TodayCaptureProps = {
  today: string;
};

export function TodayCapture({ today }: TodayCaptureProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const commandId = useRef<string | null>(null);

  const form = useForm({
    initialValues: { title: "" },
    validate: {
      title: (value) => (value.trim() ? null : t("capture.emptyTitle")),
    },
    onValuesChange: () => {
      commandId.current = null;
    },
  });

  const createTask = useMutation({
    ...createTaskMutationOptions,
    onSuccess: () => {
      commandId.current = null;
      form.setFieldValue("title", "");
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["inbox"] });
      notifications.show({
        message: t("dashboard.capture.success"),
        color: "gray",
        withCloseButton: false,
        p: "sm",
        radius: "sm",
      });
    },
    onError: () => {
      notifications.show({
        message: t("capture.error"),
        color: "red",
        withCloseButton: false,
        p: "sm",
        radius: "sm",
      });
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = form.validate();
    if (validation.hasErrors) return;

    // Stesso commandId finché il titolo non cambia: un retry non duplica il task.
    const id = commandId.current ?? newCommandId();
    commandId.current = id;
    createTask.mutate({
      commandId: id,
      title: form.values.title.trim(),
      spaceId: null,
      schedule: { allDay: true, from: null, to: today },
    });
  }

  return (
    <form onSubmit={submit}>
      <TextInput
        {...form.getInputProps("title")}
        aria-label={t("dashboard.capture.placeholder")}
        placeholder={t("dashboard.capture.placeholder")}
        leftSection={<IconPlus size={16} stroke={1.6} />}
        disabled={createTask.isPending}
      />
    </form>
  );
}

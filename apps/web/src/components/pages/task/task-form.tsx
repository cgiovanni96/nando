import {
  Alert,
  Badge,
  Button,
  Flex,
  Group,
  Select,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Tooltip,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useHotkeys } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconCalendarEvent, IconCircleDot, IconFolder } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { ApiError } from "@web/lib/api-error";
import { newCommandId } from "@web/lib/ids";
import {
  cancelTaskMutationOptions,
  completeTaskMutationOptions,
  skipTaskMutationOptions,
  updateTaskMutationOptions,
} from "@web/lib/mutations/tasks";
import type { SpaceOption } from "@web/lib/queries/spaces";
import type { TaskDetail } from "@web/lib/queries/tasks";
import { DueDateField } from "./due-date-field";
import type { DueValue } from "./due-date";
import { TaskActionsMenu } from "./task-actions-menu";
import classes from "./task-page.module.css";

const STATUS_ORDER = ["open", "completed", "skipped", "cancelled"] as const;

type TaskFormValues = {
  title: string;
  spaceId: string | null;
  due: DueValue;
};

type TaskFormProps = {
  task: TaskDetail;
  spaces: SpaceOption[];
  readOnly: boolean;
  late: boolean;
};

export function TaskForm({ task, spaces, readOnly, late }: TaskFormProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const commandId = useRef<string | null>(null);
  const [conflict, setConflict] = useState(false);

  const form = useForm<TaskFormValues>({
    mode: "uncontrolled",
    initialValues: {
      title: task.title,
      spaceId: task.spaceId,
      due: {
        at: task.dueAt ? new Date(task.dueAt) : null,
        hasTime: task.dueAtHasTime,
      },
    },
    validate: {
      title: (value) => (value.trim() ? null : t("task.form.emptyTitle")),
    },
    onValuesChange: () => {
      commandId.current = null;
      setConflict(false);
    },
  });

  function refresh(successMessage: string) {
    return {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: ["tasks"] });
        void queryClient.invalidateQueries({ queryKey: ["inbox"] });
        notifications.show({
          message: successMessage,
          color: "gray",
          withCloseButton: false,
          p: "sm",
          radius: "sm",
        });
      },
      onError: (error: Error) => {
        notifications.show({
          message: error instanceof ApiError ? error.message : t("task.form.error"),
          color: "red",
          withCloseButton: false,
          p: "sm",
          radius: "sm",
        });
      },
    };
  }

  const update = useMutation({
    ...updateTaskMutationOptions,
    onSuccess: () => {
      commandId.current = null;
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["inbox"] });
      notifications.show({
        message: t("task.form.saved"),
        color: "gray",
        withCloseButton: false,
        p: "sm",
        radius: "sm",
      });
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === "version_conflict") {
        setConflict(true);
        return;
      }

      notifications.show({
        message: error instanceof ApiError ? error.message : t("task.form.error"),
        color: "red",
        withCloseButton: false,
        p: "sm",
        radius: "sm",
      });
    },
  });

  const complete = useMutation({
    ...completeTaskMutationOptions,
    ...refresh(t("task.actions.completed")),
  });
  const skip = useMutation({ ...skipTaskMutationOptions, ...refresh(t("task.actions.skipped")) });
  const cancel = useMutation({
    ...cancelTaskMutationOptions,
    ...refresh(t("task.actions.cancelled")),
  });

  const statusPending = complete.isPending || skip.isPending || cancel.isPending;
  const statusLocked = readOnly || task.status !== "open" || form.isDirty();

  const statusData = STATUS_ORDER.map((value) => ({
    value,
    label: t(`task.status.${value}`),
    disabled: value === "open" || task.status !== "open",
  }));

  function changeStatus(value: string | null) {
    if (!value || value === task.status) return;

    const input = { commandId: newCommandId() };
    if (value === "completed") complete.mutate({ taskId: task.id, input });
    if (value === "skipped") skip.mutate({ taskId: task.id, input });
    if (value === "cancelled") cancel.mutate({ taskId: task.id, input });
  }

  function persist() {
    if (readOnly || update.isPending || !form.isDirty()) return;

    // Stesso commandId finché il payload non cambia: un retry non salva due volte.
    const id = commandId.current ?? newCommandId();
    commandId.current = id;
    const values = form.getValues();

    update.mutate({
      taskId: task.id,
      input: {
        commandId: id,
        expectedVersion: task.version,
        title: values.title.trim(),
        spaceId: values.spaceId,
        dueAt: values.due.at ? values.due.at.toISOString() : null,
        dueAtHasTime: values.due.at !== null && values.due.hasTime,
      },
    });
  }

  function save() {
    if (readOnly || update.isPending || !form.isDirty()) return;
    if (form.validate().hasErrors) return;
    persist();
  }

  // `form.onSubmit` non è usato: il lint React segnala l'accesso al ref dentro
  // la callback. La validazione resta in `save()`, quindi il comportamento è lo stesso.
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    save();
  }

  useHotkeys(
    [
      [
        "mod+S",
        (event) => {
          event.preventDefault();
          save();
        },
      ],
    ],
    [],
  );

  const disabled = readOnly || update.isPending;

  const statusSelect = (
    <Select
      value={task.status}
      onChange={changeStatus}
      data={statusData}
      allowDeselect={false}
      disabled={statusLocked || statusPending}
      aria-label={t("task.properties.status")}
      classNames={{ input: `${classes.propertyInput} ${classes.statusInput}` }}
      size="sm"
      w={130}
    />
  );

  return (
    <form onSubmit={submit} aria-label={t("task.form.ariaLabel")}>
      <Stack gap="lg">
        <Stack gap="sm">
          <Group justify="space-between" align="center" gap="md" wrap="nowrap">
            <TextInput
              key={form.key("title")}
              {...form.getInputProps("title")}
              variant="unstyled"
              className={classes.titleField}
              classNames={{ input: classes.titleInput }}
              data-completed={task.status === "completed" ? "true" : undefined}
              aria-label={t("task.form.title")}
              placeholder={t("task.form.titlePlaceholder")}
              disabled={disabled}
            />

            <TaskActionsMenu
              task={task}
              readOnly={readOnly}
              isDirty={form.isDirty()}
              isSaving={update.isPending}
              onSave={save}
              onDiscard={() => form.reset()}
            />
          </Group>

          {late || (form.isDirty() && !readOnly) ? (
            <Group gap="xs">
              {late ? (
                <Badge variant="light" color="gray">
                  {t("task.status.late")}
                </Badge>
              ) : null}
              {form.isDirty() && !readOnly ? (
                <Text size="xs" c="dimmed">
                  {t("task.form.unsaved")}
                </Text>
              ) : null}
            </Group>
          ) : null}
        </Stack>

        <Flex direction="column" gap={4} className={classes.properties}>
          <PropertyRow
            icon={<IconCircleDot size={16} stroke={1.6} />}
            label={t("task.properties.status")}
          >
            {form.isDirty() ? (
              <Tooltip label={t("task.form.statusLocked")}>
                <span className={classes.statusTooltip}>{statusSelect}</span>
              </Tooltip>
            ) : (
              statusSelect
            )}
          </PropertyRow>

          <PropertyRow
            icon={<IconCalendarEvent size={16} stroke={1.6} />}
            label={t("task.properties.dueAt")}
          >
            <DueDateField
              key={form.key("due")}
              {...form.getInputProps("due")}
              disabled={disabled}
            />
          </PropertyRow>

          <PropertyRow
            icon={<IconFolder size={16} stroke={1.6} />}
            label={t("task.properties.space")}
          >
            <Select
              key={form.key("spaceId")}
              {...form.getInputProps("spaceId")}
              variant="unstyled"
              classNames={{ input: classes.propertyInput }}
              data={spaces}
              placeholder={t("task.form.inbox")}
              aria-label={t("task.properties.space")}
              nothingFoundMessage={t("task.form.noSpaces")}
              clearable
              searchable
              disabled={disabled}
              size="sm"
            />
          </PropertyRow>
        </Flex>

        {conflict ? (
          <Alert color="yellow" variant="light" title={t("task.form.conflict.title")}>
            <Stack gap="sm">
              <Text size="sm">{t("task.form.conflict.description")}</Text>
              <Group>
                <Button
                  size="xs"
                  variant="default"
                  onClick={() => {
                    setConflict(false);
                    void queryClient.invalidateQueries({
                      queryKey: ["tasks", "detail", task.id],
                    });
                  }}
                >
                  {t("task.form.conflict.reload")}
                </Button>
              </Group>
            </Stack>
          </Alert>
        ) : null}
      </Stack>
    </form>
  );
}

type PropertyRowProps = {
  icon: ReactNode;
  label: string;
  children: ReactNode;
};

/** Riga proprietà del mock: icona + label a larghezza fissa, valore trasparente. */
function PropertyRow({ icon, label, children }: PropertyRowProps) {
  return (
    <Flex align="center" gap="md" className={classes.propertyRow}>
      <Flex align="center" gap={8} className={classes.propertyLabel}>
        <ThemeIcon variant="transparent" size={16} color="gray" aria-hidden>
          {icon}
        </ThemeIcon>
        <Text size="sm" c="dimmed" lineClamp={1}>
          {label}
        </Text>
      </Flex>
      <Flex align="center" className={classes.propertyValue}>
        {children}
      </Flex>
    </Flex>
  );
}

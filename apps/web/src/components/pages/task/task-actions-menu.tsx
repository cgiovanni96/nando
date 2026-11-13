import { Button, Group, Menu, Modal, Stack, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconCircleCheck,
  IconDeviceFloppy,
  IconDots,
  IconEditCircleOff,
  IconRestore,
  IconTrash,
} from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Fragment } from "react";
import { useTranslation } from "react-i18next";

import {
  useRegisterPageActions,
  type PageAction,
} from "@web/components/shared/commands/page-actions-context";
import { ApiError } from "@web/lib/api-error";
import { newCommandId } from "@web/lib/ids";
import { deleteTaskMutationOptions, restoreTaskMutationOptions } from "@web/lib/mutations/tasks";
import type { TaskDetail } from "@web/lib/queries/tasks";

type TaskActionsMenuProps = {
  task: TaskDetail;
  readOnly?: boolean;
  isDirty?: boolean;
  isSaving?: boolean;
  isCompleting?: boolean;
  statusPending?: boolean;
  onSave?: () => void;
  onDiscard?: () => void;
  onComplete?: () => void;
};

/**
 * Tutte le azioni del task in un unico elenco: il menu le mostra, lo spotlight
 * le legge dallo stesso registro. Il form decide disponibilità e salvataggio;
 * il menu possiede solo cancellazione, ripristino e la conferma.
 */
export function TaskActionsMenu({
  task,
  readOnly = false,
  isDirty = false,
  isSaving = false,
  isCompleting = false,
  statusPending = false,
  onSave,
  onDiscard,
  onComplete,
}: TaskActionsMenuProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [confirmOpened, { open, close }] = useDisclosure(false);

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    void queryClient.invalidateQueries({ queryKey: ["inbox"] });
    void queryClient.invalidateQueries({ queryKey: ["trash"] });
  }

  function notifyError(error: Error) {
    notifications.show({
      message: error instanceof ApiError ? error.message : t("task.actions.error"),
      color: "red",
      withCloseButton: false,
      p: "sm",
      radius: "sm",
    });
  }

  const remove = useMutation({
    ...deleteTaskMutationOptions,
    onSuccess: () => {
      close();
      invalidate();
      notifications.show({
        message: t("task.actions.deleted"),
        color: "gray",
        withCloseButton: false,
        p: "sm",
        radius: "sm",
      });
    },
    onError: notifyError,
  });

  const restore = useMutation({
    ...restoreTaskMutationOptions,
    onSuccess: () => {
      invalidate();
      notifications.show({
        message: t("task.actions.restored"),
        color: "gray",
        withCloseButton: false,
        p: "sm",
        radius: "sm",
      });
    },
    onError: notifyError,
  });

  const deleted = task.deletedAt !== null;

  const saveAction: PageAction | null = onSave
    ? {
        id: "save",
        label: t("task.actions.save"),
        icon: <IconDeviceFloppy size={16} stroke={1.6} />,
        disabled: readOnly || !isDirty || isSaving,
        shortcut: t("commands.shortcuts.save"),
        onTrigger: onSave,
      }
    : null;

  const discardAction: PageAction | null = onDiscard
    ? {
        id: "discard",
        label: t("task.form.discard"),
        icon: <IconEditCircleOff size={16} stroke={1.6} />,
        disabled: !isDirty || isSaving,
        onTrigger: onDiscard,
      }
    : null;

  const completeAction: PageAction | null = onComplete
    ? {
        id: "complete",
        label: t("task.actions.complete"),
        icon: <IconCircleCheck size={16} stroke={1.6} />,
        disabled: readOnly || task.status !== "open" || isDirty || isCompleting || statusPending,
        onTrigger: onComplete,
      }
    : null;

  const actions: PageAction[] = deleted
    ? [
        {
          id: "restore",
          label: t("task.deleted.restore"),
          icon: <IconRestore size={16} stroke={1.6} />,
          disabled: restore.isPending,
          onTrigger: () =>
            restore.mutate({
              taskId: task.id,
              input: { commandId: newCommandId() },
            }),
        },
      ]
    : [
        ...(saveAction ? [saveAction] : []),
        ...(discardAction ? [discardAction] : []),
        ...(completeAction ? [completeAction] : []),
        {
          id: "delete",
          label: t("task.actions.delete"),
          icon: <IconTrash size={16} stroke={1.6} />,
          color: "red",
          disabled: readOnly,
          onTrigger: open,
        },
      ];

  useRegisterPageActions(actions);

  return (
    <>
      <Menu position="bottom-end" width={220} withinPortal>
        <Menu.Target>
          <Button
            variant="default"
            size="xs"
            leftSection={<IconDots size={16} stroke={1.6} />}
            aria-label={t("task.actions.menu")}
          >
            {t("task.actions.menu")}
          </Button>
        </Menu.Target>

        <Menu.Dropdown>
          {actions.map((action) => (
            <Fragment key={action.id}>
              {action.id === "delete" ? <Menu.Divider /> : null}
              <Menu.Item
                {...(action.color ? { color: action.color } : {})}
                leftSection={action.icon}
                disabled={action.disabled}
                onClick={action.onTrigger}
              >
                {action.label}
              </Menu.Item>
            </Fragment>
          ))}
        </Menu.Dropdown>
      </Menu>

      {deleted ? null : (
        <Modal opened={confirmOpened} onClose={close} title={t("task.delete.title")} centered>
          <Stack gap="md">
            <Text size="sm">{t("task.delete.description")}</Text>
            <Group justify="flex-end" gap="xs">
              <Button variant="default" onClick={close}>
                {t("task.delete.cancel")}
              </Button>
              <Button
                color="red"
                loading={remove.isPending}
                onClick={() =>
                  remove.mutate({
                    taskId: task.id,
                    input: { commandId: newCommandId() },
                  })
                }
              >
                {t("task.delete.confirm")}
              </Button>
            </Group>
          </Stack>
        </Modal>
      )}
    </>
  );
}

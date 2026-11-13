import { Button, Group, Menu, Modal, Stack, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconDeviceFloppy,
  IconDots,
  IconEditCircleOff,
  IconRestore,
  IconTrash,
} from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiError } from "@web/lib/api-error";
import { newCommandId } from "@web/lib/ids";
import { deleteTaskMutationOptions, restoreTaskMutationOptions } from "@web/lib/mutations/tasks";
import type { TaskDetail } from "@web/lib/queries/tasks";

type TaskActionsMenuProps = {
  task: TaskDetail;
  readOnly?: boolean;
  isDirty?: boolean;
  isSaving?: boolean;
  onSave?: () => void;
  onDiscard?: () => void;
};

/**
 * Tutte le azioni del task in un unico menu: salvataggio, scarto delle
 * modifiche, cancellazione e ripristino. Il form decide quando `onSave` è
 * disponibile, lo stato dirty e il salvataggio in corso.
 */
export function TaskActionsMenu({
  task,
  readOnly = false,
  isDirty = false,
  isSaving = false,
  onSave,
  onDiscard,
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
          {deleted ? (
            <Menu.Item
              leftSection={<IconRestore size={16} stroke={1.6} />}
              disabled={restore.isPending}
              onClick={() =>
                restore.mutate({
                  taskId: task.id,
                  input: { commandId: newCommandId() },
                })
              }
            >
              {t("task.deleted.restore")}
            </Menu.Item>
          ) : (
            <>
              {onSave ? (
                <Menu.Item
                  leftSection={<IconDeviceFloppy size={16} stroke={1.6} />}
                  disabled={readOnly || !isDirty || isSaving}
                  onClick={onSave}
                >
                  {t("task.actions.save")}
                </Menu.Item>
              ) : null}
              {onDiscard ? (
                <Menu.Item
                  disabled={!isDirty || isSaving}
                  onClick={onDiscard}
                  leftSection={<IconEditCircleOff size={16} stroke={1.6} />}
                >
                  {t("task.form.discard")}
                </Menu.Item>
              ) : null}
              <Menu.Divider />
              <Menu.Item
                color="red"
                leftSection={<IconTrash size={16} stroke={1.6} />}
                disabled={readOnly}
                onClick={open}
              >
                {t("task.actions.delete")}
              </Menu.Item>
            </>
          )}
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

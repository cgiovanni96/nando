import { Button, Card, Center, EmptyState, Group, Loader, Modal, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { IconInbox } from "@tabler/icons-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { newCommandId } from "@web/lib/ids";
import { deleteTaskMutationOptions, moveTaskMutationOptions } from "@web/lib/mutations/tasks";
import { inboxQueryOptions, type InboxItem } from "@web/lib/queries/inbox";
import { spaceOptionsQueryOptions } from "@web/lib/queries/spaces";
import { InboxTaskRow } from "./inbox-task-row";

export function InboxList() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const isBrowser = typeof window !== "undefined";
  const [pendingDelete, setPendingDelete] = useState<InboxItem | null>(null);

  const inbox = useQuery({ ...inboxQueryOptions, enabled: isBrowser });
  const spaces = useQuery({ ...spaceOptionsQueryOptions, enabled: isBrowser });

  function refresh(messages: { success: string; error: string }) {
    return {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: ["inbox"] });
        void queryClient.invalidateQueries({ queryKey: ["tasks"] });
        void queryClient.invalidateQueries({ queryKey: ["trash"] });
        notifications.show({
          message: messages.success,
          color: "gray",
          withCloseButton: false,
          p: "sm",
          radius: "sm",
        });
      },
      onError: () => {
        notifications.show({
          message: messages.error,
          color: "red",
          withCloseButton: false,
          p: "sm",
          radius: "sm",
        });
      },
    };
  }

  const move = useMutation({
    ...moveTaskMutationOptions,
    ...refresh({ success: t("inbox.moved"), error: t("inbox.moveError") }),
  });

  const remove = useMutation({
    ...deleteTaskMutationOptions,
    onSuccess: () => {
      setPendingDelete(null);
      void queryClient.invalidateQueries({ queryKey: ["inbox"] });
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["trash"] });
      notifications.show({
        message: t("inbox.deleted"),
        color: "gray",
        withCloseButton: false,
        p: "sm",
        radius: "sm",
      });
    },
    onError: () => {
      notifications.show({
        message: t("inbox.deleteError"),
        color: "red",
        withCloseButton: false,
        p: "sm",
        radius: "sm",
      });
    },
  });

  const items = inbox.data ?? [];
  const spaceOptions = spaces.data ?? [];

  return (
    <Card>
      <Stack gap="xs">
        {inbox.isPending ? (
          <Center py="lg">
            <Loader size="sm" aria-label={t("inbox.list.loading")} />
          </Center>
        ) : null}

        {inbox.isError ? (
          <Text size="sm" c="red" role="alert">
            {t("inbox.list.error")}
          </Text>
        ) : null}

        {inbox.isSuccess && items.length === 0 ? (
          <EmptyState icon={<IconInbox size={24} stroke={1.5} />} title={t("inbox.empty.title")} />
        ) : null}

        {items.map((item) => (
          <InboxTaskRow
            key={item.id}
            item={item}
            spaces={spaceOptions}
            moving={move.isPending && move.variables?.taskId === item.id}
            deleting={remove.isPending && remove.variables?.taskId === item.id}
            onMove={(spaceId) =>
              move.mutate({ taskId: item.id, input: { commandId: newCommandId(), spaceId } })
            }
            onDelete={() => setPendingDelete(item)}
          />
        ))}
      </Stack>

      <Modal
        opened={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title={t("inbox.delete.title")}
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            {pendingDelete ? t("inbox.delete.description", { title: pendingDelete.title }) : null}
          </Text>
          <Group justify="flex-end" gap="xs">
            <Button variant="default" onClick={() => setPendingDelete(null)}>
              {t("inbox.delete.cancel")}
            </Button>
            <Button
              color="red"
              loading={remove.isPending}
              onClick={() => {
                if (!pendingDelete) return;
                remove.mutate({
                  taskId: pendingDelete.id,
                  input: { commandId: newCommandId() },
                });
              }}
            >
              {t("inbox.delete.confirm")}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Card>
  );
}

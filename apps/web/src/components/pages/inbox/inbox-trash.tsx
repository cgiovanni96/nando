import { Button, Card, Group, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { formatDateTime } from "@web/lib/format/datetime";
import { newCommandId } from "@web/lib/ids";
import { restoreTaskMutationOptions } from "@web/lib/mutations/tasks";
import { deletedTasksQueryOptions } from "@web/lib/queries/tasks";
import classes from "./inbox-page.module.css";

/**
 * Cestino dell'Inbox: i task cancellati dentro la finestra di grazia.
 * La lista arriva dal server con `restorableUntil`, quindi il client non
 * ricalcola la scadenza.
 */
export function InboxTrash() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const isBrowser = typeof window !== "undefined";

  const deleted = useQuery({ ...deletedTasksQueryOptions, enabled: isBrowser });

  const restore = useMutation({
    ...restoreTaskMutationOptions,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["inbox"] });
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      notifications.show({
        message: t("inbox.restored"),
        color: "gray",
        withCloseButton: false,
        p: "sm",
        radius: "sm",
      });
    },
    onError: () => {
      notifications.show({
        message: t("inbox.restoreError"),
        color: "red",
        withCloseButton: false,
        p: "sm",
        radius: "sm",
      });
    },
  });

  const items = deleted.data ?? [];
  if (items.length === 0) return null;

  return (
    <Card>
      <Stack gap="xs">
        <Stack gap={2}>
          <Text fz="xs" c="dimmed">
            {t("inbox.trash.eyebrow")}
          </Text>
          <Text size="sm" c="dimmed">
            {t("inbox.trash.description")}
          </Text>
        </Stack>

        {items.map((item) => (
          <Group
            key={item.id}
            gap="md"
            wrap="nowrap"
            justify="space-between"
            className={classes.row}
          >
            <Stack gap={2}>
              <Text fw={500} className={classes.title} title={item.title}>
                {item.title}
              </Text>
              {item.restorableUntil ? (
                <Text size="xs" c="dimmed" className={classes.meta}>
                  {t("inbox.trash.restorableUntil", {
                    date: formatDateTime(item.restorableUntil),
                  })}
                </Text>
              ) : null}
            </Stack>

            <Button
              size="xs"
              variant="light"
              loading={restore.isPending && restore.variables?.taskId === item.id}
              onClick={() =>
                restore.mutate({
                  taskId: item.id,
                  input: { commandId: newCommandId() },
                })
              }
            >
              {t("inbox.trash.restore")}
            </Button>
          </Group>
        ))}
      </Stack>
    </Card>
  );
}

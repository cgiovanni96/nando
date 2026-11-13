import { Button, EmptyState, Skeleton, Table, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { IconTrash } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

import { ApiError } from "@web/lib/api-error";
import { formatDateTime } from "@web/lib/format/datetime";
import { newCommandId } from "@web/lib/ids";
import { restoreTaskMutationOptions } from "@web/lib/mutations/tasks";
import { deletedTasksQueryOptions } from "@web/lib/queries/tasks";

/**
 * Lista dei task nel cestino. Le API sono per tipo: quando esisteranno Space o
 * altre entità cancellabili arriverà una tab con la propria lista.
 */
export function TrashTaskList() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const isBrowser = typeof window !== "undefined";

  const deleted = useQuery({ ...deletedTasksQueryOptions, enabled: isBrowser });

  const restore = useMutation({
    ...restoreTaskMutationOptions,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["trash"] });
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["inbox"] });
      notifications.show({
        message: t("trash.restored"),
        color: "gray",
        withCloseButton: false,
        p: "sm",
        radius: "sm",
      });
    },
    onError: (error: Error) => {
      notifications.show({
        message: error instanceof ApiError ? error.message : t("trash.restoreError"),
        color: "red",
        withCloseButton: false,
        p: "sm",
        radius: "sm",
      });
    },
  });

  if (deleted.isPending) {
    return <Skeleton height={120} radius="md" />;
  }

  if (deleted.isError) {
    return (
      <Text size="sm" c="red" role="alert">
        {t("trash.error")}
      </Text>
    );
  }

  const items = deleted.data ?? [];

  if (items.length === 0) {
    return <EmptyState icon={<IconTrash size={24} stroke={1.5} />} title={t("trash.empty")} />;
  }

  return (
    <Table.ScrollContainer minWidth={560}>
      <Table verticalSpacing="sm" highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t("trash.columns.title")}</Table.Th>
            <Table.Th>{t("trash.columns.deletedAt")}</Table.Th>
            <Table.Th>{t("trash.columns.restorableUntil")}</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {items.map((item) => (
            <Table.Tr key={item.id}>
              <Table.Td>
                <Text fw={500} lineClamp={1} title={item.title}>
                  {item.title}
                </Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm" c="dimmed">
                  {item.deletedAt ? formatDateTime(item.deletedAt) : null}
                </Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm" c="dimmed">
                  {item.restorableUntil ? formatDateTime(item.restorableUntil) : null}
                </Text>
              </Table.Td>
              <Table.Td>
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
                  {t("task.deleted.restore")}
                </Button>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

import {
  Alert,
  Anchor,
  Breadcrumbs,
  EmptyState,
  Group,
  Skeleton,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { IconAlertTriangle, IconCheck, IconFileDescription } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { ApiError } from "@web/lib/api-error";
import { formatDateTime } from "@web/lib/format/datetime";
import {
  spaceOptionsQueryOptions,
  spacePathQueryOptions,
  spaceQueryOptions,
} from "@web/lib/queries/spaces";
import { taskQueryOptions, type TaskDetail } from "@web/lib/queries/tasks";
import classes from "./task-page.module.css";
import { TaskActionsMenu } from "./task-actions-menu";
import { TaskForm } from "./task-form";

export function TaskPage() {
  const { t } = useTranslation();
  const { taskId } = useParams({ from: "/tasks/$taskId" });
  const isBrowser = typeof window !== "undefined";

  const task = useQuery({ ...taskQueryOptions(taskId), enabled: isBrowser });
  const spaces = useQuery({ ...spaceOptionsQueryOptions, enabled: isBrowser });
  const spaceId = task.data?.spaceId ?? null;
  const hasSpace = spaceId !== null;
  const space = useQuery({
    ...spaceQueryOptions(spaceId ?? ""),
    enabled: isBrowser && hasSpace,
  });
  const spacePath = useQuery({
    ...spacePathQueryOptions(spaceId ?? ""),
    enabled: isBrowser && hasSpace,
  });

  if (task.isPending) {
    return (
      <Stack gap="lg" className={classes.entity} aria-busy>
        <Skeleton height={44} width={44} radius="md" />
        <Skeleton height={12} width={120} />
        <Skeleton height={36} width="60%" />
        <Skeleton height={160} radius="md" />
      </Stack>
    );
  }

  if (task.isError) {
    const notFound = task.error instanceof ApiError && task.error.code === "not_found";

    return (
      <EmptyState
        icon={<IconFileDescription size={24} stroke={1.5} />}
        title={notFound ? t("task.notFound.title") : t("task.error.title")}
        description={notFound ? t("task.notFound.description") : t("task.error.description")}
      >
        <Anchor component={Link} to="/inbox" size="sm">
          {t("task.backToInbox")}
        </Anchor>
      </EmptyState>
    );
  }

  const detail = task.data;
  const deleted = detail.deletedAt !== null;
  const archived = space.data?.archivedAt != null;
  const spaceOptions = spaces.data ?? [];
  const optionsWithCurrent =
    space.data && !spaceOptions.some((option) => option.value === space.data.id)
      ? [...spaceOptions, { value: space.data.id, label: space.data.name }]
      : spaceOptions;

  const crumbs = hasSpace ? (spacePath.data ?? []) : [t("task.inboxLabel")];
  const late =
    detail.status === "open" &&
    detail.dueAt !== null &&
    new Date(detail.dueAt).getTime() < task.dataUpdatedAt;

  return (
    <Stack gap="lg" className={classes.entity}>
      <Stack gap="xs">
        <ThemeIcon size={44} radius="md" variant="default" aria-hidden>
          <IconCheck size={24} stroke={1.5} />
        </ThemeIcon>

        {hasSpace && spacePath.isPending ? (
          <Skeleton height={10} width={140} />
        ) : (
          <Breadcrumbs separator="/" aria-label={t("task.breadcrumb")}>
            {crumbs.map((crumb, index) => (
              <Text key={`${crumb}-${index}`} size="xs" c="dimmed">
                {crumb}
              </Text>
            ))}
          </Breadcrumbs>
        )}
      </Stack>

      {archived && !deleted ? (
        <Alert
          color="yellow"
          variant="light"
          icon={<IconAlertTriangle size={18} stroke={1.6} />}
          title={t("task.readOnly.title")}
        >
          {t("task.readOnly.description")}
        </Alert>
      ) : null}

      {deleted ? (
        <Stack gap="md">
          <Group justify="space-between" align="center" gap="md" wrap="nowrap">
            <Title
              order={1}
              className={
                detail.status === "completed"
                  ? `${classes.entityTitle} ${classes.titleDone}`
                  : classes.entityTitle
              }
            >
              {detail.title}
            </Title>
            <TaskActionsMenu task={detail} />
          </Group>
          <DeletedTaskNotice task={detail} />
        </Stack>
      ) : (
        <TaskForm
          key={detail.version}
          task={detail}
          spaces={optionsWithCurrent}
          readOnly={archived}
          late={late}
        />
      )}
    </Stack>
  );
}

/** Notice discreto con le date della finestra di grazia. */
function DeletedTaskNotice({ task }: Readonly<{ task: TaskDetail }>) {
  const { t } = useTranslation();

  if (!task.deletedAt || !task.restorableUntil) return null;

  return (
    <Alert color="gray" variant="light" title={t("task.deleted.title")}>
      {t("task.deleted.description", {
        deletedAt: formatDateTime(task.deletedAt),
        restorableUntil: formatDateTime(task.restorableUntil),
      })}
    </Alert>
  );
}

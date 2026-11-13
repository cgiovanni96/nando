import { ActionIcon, Group, Select } from "@mantine/core";
import { IconTrash } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import type { InboxItem } from "@web/lib/queries/inbox";
import type { SpaceOption } from "@web/lib/queries/spaces";
import classes from "./inbox-page.module.css";

type InboxTaskRowProps = {
  item: InboxItem;
  spaces: SpaceOption[];
  moving: boolean;
  deleting: boolean;
  onMove: (spaceId: string) => void;
  onDelete: () => void;
};

export function InboxTaskRow({
  item,
  spaces,
  moving,
  deleting,
  onMove,
  onDelete,
}: InboxTaskRowProps) {
  const { t } = useTranslation();

  return (
    <Group gap="md" wrap="nowrap" className={classes.row} justify="space-between">
      <Link
        to="/tasks/$taskId"
        params={{ taskId: item.id }}
        className={`${classes.rowTitle} ${classes.rowLink}`}
        title={item.title}
      >
        {item.title}
      </Link>

      <Group gap="xs" wrap="nowrap">
        <Select
          size="xs"
          w={190}
          data={spaces}
          value={null}
          onChange={(value) => {
            if (value) onMove(value);
          }}
          placeholder={t("inbox.actions.move")}
          aria-label={t("inbox.actions.moveAria", { title: item.title })}
          nothingFoundMessage={t("inbox.actions.noSpaces")}
          searchable
          disabled={moving || deleting || spaces.length === 0}
        />
        <ActionIcon
          variant="subtle"
          color="red"
          onClick={onDelete}
          loading={deleting}
          disabled={moving}
          aria-label={t("inbox.actions.deleteAria", { title: item.title })}
        >
          <IconTrash size={16} stroke={1.6} />
        </ActionIcon>
      </Group>
    </Group>
  );
}

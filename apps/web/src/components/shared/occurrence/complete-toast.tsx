import { Button, Group, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";

type CompleteToastProps = {
  onUndo: () => void;
};

function CompleteToast({ onUndo }: CompleteToastProps) {
  const { t } = useTranslation();

  return (
    <Group gap="sm" justify="space-between" wrap="nowrap">
      <Text size="sm">{t("task.actions.completed")}</Text>
      <Button size="compact-xs" variant="subtle" onClick={onUndo}>
        {t("task.actions.undo")}
      </Button>
    </Group>
  );
}

export function showCompleteToast(onUndo: () => void) {
  return notifications.show({
    message: <CompleteToast onUndo={onUndo} />,
    color: "gray",
    withCloseButton: false,
    autoClose: 6000,
    p: "sm",
    radius: "sm",
  });
}

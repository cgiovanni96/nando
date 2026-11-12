import { Popover, Stack, Text } from "@mantine/core";
import type { ReactNode } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { QuickCaptureForm } from "./quick-capture-form";

type QuickCapturePopoverProps = {
  children: ReactNode;
  position?: "bottom-end" | "right-start";
};

export function QuickCapturePopover({
  children,
  position = "bottom-end",
}: QuickCapturePopoverProps) {
  const { t } = useTranslation();
  const [opened, setOpened] = useState(false);

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      position={position}
      width={380}
      shadow="md"
      returnFocus
      withArrow
    >
      <Popover.Target>{children}</Popover.Target>
      <Popover.Dropdown>
        <Stack gap="md">
          <Text fw={500}>{t("capture.title")}</Text>
          <QuickCaptureForm layout="compact" autoFocus />
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}

import { Popover, Stack, Text } from "@mantine/core";
import type { MouseEvent, ReactElement } from "react";
import { cloneElement, useState } from "react";
import { useTranslation } from "react-i18next";

import { QuickCaptureForm } from "./quick-capture-form";

type QuickCaptureTrigger = ReactElement<{
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
}>;

type QuickCapturePopoverProps = {
  children: QuickCaptureTrigger;
  position?: "bottom-end" | "right-start";
};

export function QuickCapturePopover({
  children,
  position = "bottom-end",
}: QuickCapturePopoverProps) {
  const { t } = useTranslation();
  const [opened, setOpened] = useState(false);

  // In controlled mode Mantine non collega l'onClick del target: lo facciamo
  // qui, sul trigger vero, per non perdere ref, focus e posizionamento.
  const trigger = cloneElement(children, {
    onClick: (event: MouseEvent<HTMLButtonElement>) => {
      children.props.onClick?.(event);
      setOpened((current) => !current);
    },
  });

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
      <Popover.Target>{trigger}</Popover.Target>
      <Popover.Dropdown>
        <Stack gap="md">
          <Text fw={500}>{t("capture.title")}</Text>
          <QuickCaptureForm layout="compact" autoFocus onCreated={() => setOpened(false)} />
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}

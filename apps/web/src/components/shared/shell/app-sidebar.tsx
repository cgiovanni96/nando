import { AppShell as MantineAppShell, Box, Button, Group, Stack, Text } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

import { QuickCapturePopover } from "@web/components/shared/capture/quick-capture-popover";
import { AppNav } from "./app-nav";
import classes from "./app-shell.module.css";

export function AppSidebar({ pathname }: Readonly<{ pathname: string }>) {
  const { t } = useTranslation();

  return (
    <MantineAppShell.Navbar
      className={classes.navbar}
      px={{ base: 12, md: 16 }}
      pt={{ base: 12, md: 24 }}
      pb={{ base: 12, md: 16 }}
      aria-label={t("nav.primary.ariaLabel")}
    >
      <Stack h="100%" gap="xl">
        <Group gap={10} px={8} wrap="nowrap">
          <Box className={classes.brandMark} aria-hidden="true">
            N
          </Box>
          <Text fz={22} fw={600} lts="-0.8px" visibleFrom="md">
            {t("app.name")}
          </Text>
        </Group>

        <QuickCapturePopover position="right-start">
          <Button
            variant="default"
            fullWidth
            justify="flex-start"
            leftSection={<IconPlus size={16} stroke={1.6} />}
            aria-label={t("capture.title")}
            title={t("capture.title")}
          >
            <Box component="span" visibleFrom="md">
              {t("shell.capture")}
            </Box>
          </Button>
        </QuickCapturePopover>

        <Box flex={1} c="dimmed">
          <AppNav pathname={pathname} />
        </Box>

        <Group className={classes.userRow} gap="md" pt="md" wrap="nowrap">
          <Box className={classes.userMonogram} aria-hidden="true">
            N
          </Box>
          <Stack gap={0} visibleFrom="md">
            <Text fz="sm" fw={500}>
              {t("shell.workspace.name")}
            </Text>
            <Text fz={11} c="dimmed">
              {t("shell.workspace.role")}
            </Text>
          </Stack>
        </Group>
      </Stack>
    </MantineAppShell.Navbar>
  );
}

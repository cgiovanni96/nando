import {
  Divider,
  Group,
  Popover,
  Stack,
  Switch,
  Text,
  TextInput,
  UnstyledButton,
} from "@mantine/core";
import { DatePicker, TimeInput } from "@mantine/dates";
import { useDisclosure, useUncontrolled } from "@mantine/hooks";
import { IconChevronRight } from "@tabler/icons-react";
import dayjs from "dayjs";
import type { ChangeEvent, FocusEventHandler, ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { EMPTY_DUE, formatDue, setDueDate, setDueTime, withToday, type DueValue } from "./due-date";
import classes from "./due-date-field.module.css";

type DueDateFieldProps = {
  value?: DueValue;
  defaultValue?: DueValue;
  onChange?: (value: DueValue) => void;
  error?: ReactNode;
  disabled?: boolean;
  onFocus?: FocusEventHandler<HTMLButtonElement>;
  onBlur?: FocusEventHandler<HTMLButtonElement>;
  "data-path"?: string;
};

/**
 * Campo data in stile Notion: trigger nel property row e pannello con calendario,
 * “Oggi”, “Includi orario” e “Cancella”. È un custom input Mantine: accetta
 * value/defaultValue/onChange per funzionare sia controlled sia uncontrolled.
 */
export function DueDateField({
  value,
  defaultValue,
  onChange,
  error,
  disabled = false,
  onFocus,
  onBlur,
  "data-path": dataPath,
}: DueDateFieldProps) {
  const { t } = useTranslation();
  const [opened, { open, close, toggle }] = useDisclosure(false);
  const [current, setCurrent] = useUncontrolled<DueValue>({
    ...(value !== undefined ? { value } : {}),
    ...(defaultValue !== undefined ? { defaultValue } : {}),
    ...(onChange ? { onChange } : {}),
    finalValue: EMPTY_DUE,
  });

  const formatted = formatDue(current);
  const timeValue = current.at ? dayjs(current.at).format("HH:mm") : "";

  function handleTime(event: ChangeEvent<HTMLInputElement>) {
    const [hours, minutes] = event.currentTarget.value.split(":").map(Number);

    if (
      !current.at ||
      hours === undefined ||
      minutes === undefined ||
      Number.isNaN(hours) ||
      Number.isNaN(minutes)
    ) {
      return;
    }

    setCurrent({
      at: dayjs(current.at).hour(hours).minute(minutes).second(0).millisecond(0).toDate(),
      hasTime: true,
    });
  }

  function clear() {
    setCurrent(EMPTY_DUE);
    close();
  }

  return (
    <Stack gap={2} align="flex-start">
      <Popover
        opened={opened}
        onChange={(next) => (next ? open() : close())}
        position="bottom-start"
        width="min(344px, calc(100vw - 2rem))"
        shadow="md"
        radius="md"
        withinPortal
      >
        <Popover.Target>
          <UnstyledButton
            type="button"
            className={classes.trigger}
            disabled={disabled}
            data-path={dataPath}
            onFocus={onFocus}
            onBlur={onBlur}
            onClick={toggle}
            aria-label={`${t("task.properties.dueAt")}: ${
              formatted ?? t("task.form.dueAtPlaceholder")
            }`}
          >
            <Text size="sm" {...(current.at ? {} : { c: "dimmed" })}>
              {formatted ?? t("task.form.dueAtPlaceholder")}
            </Text>
          </UnstyledButton>
        </Popover.Target>

        <Popover.Dropdown p={0}>
          <Stack gap={0}>
            <Stack gap="sm" p="md">
              <TextInput
                readOnly
                value={formatted ?? ""}
                placeholder={t("task.form.dueAtPlaceholder")}
                aria-label={t("task.properties.dueAt")}
                classNames={{ input: classes.summary }}
              />
              <DatePicker
                value={current.at}
                onChange={(date) => setCurrent(setDueDate(current, date))}
                firstDayOfWeek={1}
                // Su Mantine 9.7.5 è un formato dayjs, non la keyword della 9.8.
                weekdayFormat="dd"
                highlightToday
                allowDeselect={false}
                size="sm"
                mx="auto"
              />
            </Stack>

            <Divider />

            <Stack gap={0} p="xs">
              <UnstyledButton
                className={classes.row}
                onClick={() => setCurrent(withToday(current, new Date()))}
              >
                <Text size="sm">{t("task.due.today")}</Text>
                <IconChevronRight size={16} stroke={1.6} />
              </UnstyledButton>

              <Group justify="space-between" gap="md" wrap="nowrap" className={classes.row}>
                <Text size="sm">{t("task.due.includeTime")}</Text>
                <Switch
                  checked={current.hasTime}
                  onChange={(event) => setCurrent(setDueTime(current, event.currentTarget.checked))}
                  disabled={!current.at}
                  size="sm"
                  aria-label={t("task.due.includeTime")}
                />
              </Group>

              {current.hasTime && current.at ? (
                <Group justify="space-between" gap="md" wrap="nowrap" className={classes.row}>
                  <Text size="sm">{t("task.due.time")}</Text>
                  <TimeInput
                    value={timeValue}
                    onChange={handleTime}
                    withSeconds={false}
                    size="xs"
                    aria-label={t("task.due.time")}
                    className={classes.timeInput}
                  />
                </Group>
              ) : null}
            </Stack>

            <Divider />

            <Stack p="xs">
              <UnstyledButton
                className={`${classes.row} ${classes.clear}`}
                onClick={clear}
                aria-label={t("task.due.clear")}
              >
                <Text size="sm">{t("task.due.clear")}</Text>
              </UnstyledButton>
            </Stack>
          </Stack>
        </Popover.Dropdown>
      </Popover>

      {error ? (
        <Text size="xs" c="red" role="alert">
          {error}
        </Text>
      ) : null}
    </Stack>
  );
}

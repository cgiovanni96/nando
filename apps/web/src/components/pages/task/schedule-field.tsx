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
import { useState, type ChangeEvent, type FocusEventHandler, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import {
  EMPTY_DRAFT,
  formatDraft,
  setDraftDates,
  setDraftIncludeTime,
  setDraftRange,
  setDraftTime,
  type ScheduleDraft,
} from "./schedule-draft";
import classes from "./schedule-field.module.css";

type ScheduleFieldProps = {
  /** Timezone IANA del task: «Oggi» è il giorno corrente lì, non nel browser. */
  timeZone: string;
  value?: ScheduleDraft;
  defaultValue?: ScheduleDraft;
  onChange?: (value: ScheduleDraft) => void;
  error?: ReactNode;
  disabled?: boolean;
  onFocus?: FocusEventHandler<HTMLButtonElement>;
  onBlur?: FocusEventHandler<HTMLButtonElement>;
  "data-path"?: string;
};

const PICKER_PROPS = {
  firstDayOfWeek: 1,
  // Su Mantine 9.7.5 è un formato dayjs, non la keyword della 9.8.
  weekdayFormat: "dd",
  highlightToday: true,
  size: "sm",
  mx: "auto",
} as const;

/**
 * Campo Schedule in stile Notion (ADR-0004): scadenza, intervallo opzionale e
 * orario. È un custom input Mantine: value/defaultValue/onChange, quindi
 * funziona con `useForm` sia controlled sia uncontrolled.
 */
export function ScheduleField({
  timeZone,
  value,
  defaultValue,
  onChange,
  error,
  disabled = false,
  onFocus,
  onBlur,
  "data-path": dataPath,
}: ScheduleFieldProps) {
  const { t } = useTranslation();
  const [opened, { open, close, toggle }] = useDisclosure(false);
  const [draft, setDraft] = useUncontrolled<ScheduleDraft>({
    ...(value !== undefined ? { value } : {}),
    ...(defaultValue !== undefined ? { defaultValue } : {}),
    ...(onChange ? { onChange } : {}),
    finalValue: EMPTY_DRAFT,
  });

  // Il DatePicker a intervallo segnala prima `[inizio, null]` e poi
  // `[inizio, fine]`: il primo click resta in sospeso finché non arriva il
  // secondo, altrimenti ogni click ricomincerebbe la selezione.
  const [pendingRange, setPendingRange] = useState<[string | null, string | null] | null>(null);

  function handleRange([first, second]: [string | null, string | null]) {
    if (first && !second) {
      setPendingRange([first, null]);
      return;
    }
    setPendingRange(null);
    setDraft(setDraftDates(draft, [first, second]));
  }

  const formatted = formatDraft(draft);
  const placeholder = t("task.form.dueAtPlaceholder");

  function handleTime(which: "start" | "end") {
    return (event: ChangeEvent<HTMLInputElement>) =>
      setDraft(setDraftTime(draft, which, event.currentTarget.value));
  }

  function today() {
    const day = dayjs().tz(timeZone).format("YYYY-MM-DD");
    setDraft(setDraftDates(draft, [day, draft.range ? day : null]));
  }

  function clear() {
    setDraft(EMPTY_DRAFT);
    close();
  }

  const timeRow = (label: string, which: "start" | "end") => (
    <Group justify="space-between" gap="md" wrap="nowrap" className={classes.row}>
      <Text size="sm">{label}</Text>
      <TimeInput
        value={draft[which]?.time ?? ""}
        onChange={handleTime(which)}
        withSeconds={false}
        size="xs"
        aria-label={label}
        className={classes.timeInput}
      />
    </Group>
  );

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
            aria-label={`${t("task.properties.dueAt")}: ${formatted ?? placeholder}`}
          >
            <Text size="sm" {...(draft.end ? {} : { c: "dimmed" })}>
              {formatted ?? placeholder}
            </Text>
          </UnstyledButton>
        </Popover.Target>

        <Popover.Dropdown p={0}>
          <Stack gap={0}>
            <Stack gap="sm" p="md">
              <TextInput
                readOnly
                value={formatted ?? ""}
                placeholder={placeholder}
                aria-label={t("task.properties.dueAt")}
                classNames={{ input: classes.summary }}
              />
              {draft.range ? (
                <DatePicker
                  type="range"
                  allowSingleDateInRange
                  value={pendingRange ?? [draft.start?.date ?? null, draft.end?.date ?? null]}
                  onChange={handleRange}
                  {...PICKER_PROPS}
                />
              ) : (
                <DatePicker
                  value={draft.end?.date ?? null}
                  onChange={(day) => setDraft(setDraftDates(draft, [day, null]))}
                  allowDeselect={false}
                  {...PICKER_PROPS}
                />
              )}
            </Stack>

            <Divider />

            <Stack gap={0} p="xs">
              <UnstyledButton className={classes.row} onClick={today}>
                <Text size="sm">{t("task.due.today")}</Text>
                <IconChevronRight size={16} stroke={1.6} />
              </UnstyledButton>

              <Group justify="space-between" gap="md" wrap="nowrap" className={classes.row}>
                <Text size="sm">{t("task.due.range")}</Text>
                <Switch
                  checked={draft.range}
                  onChange={(event) => setDraft(setDraftRange(draft, event.currentTarget.checked))}
                  disabled={!draft.end}
                  size="sm"
                  aria-label={t("task.due.range")}
                />
              </Group>

              <Group justify="space-between" gap="md" wrap="nowrap" className={classes.row}>
                <Text size="sm">{t("task.due.includeTime")}</Text>
                <Switch
                  checked={draft.includeTime}
                  onChange={(event) =>
                    setDraft(setDraftIncludeTime(draft, event.currentTarget.checked))
                  }
                  disabled={!draft.end}
                  size="sm"
                  aria-label={t("task.due.includeTime")}
                />
              </Group>

              {draft.includeTime && draft.end ? (
                draft.range ? (
                  <>
                    {timeRow(t("task.due.start"), "start")}
                    {timeRow(t("task.due.end"), "end")}
                  </>
                ) : (
                  timeRow(t("task.due.time"), "end")
                )
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

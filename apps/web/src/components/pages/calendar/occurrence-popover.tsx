import { Box, Popover } from "@mantine/core";
import { useState } from "react";

import type { AgendaItem } from "@web/lib/queries/agenda";
import { OccurrenceCard } from "./occurrence-card";
import classes from "./occurrence-popover.module.css";

export type OccurrenceSelection = { item: AgendaItem; rect: DOMRect };

type OccurrencePopoverProps = {
  selection: OccurrenceSelection | null;
  onClose: () => void;
};

export function OccurrencePopover({ selection, onClose }: OccurrencePopoverProps) {
  // Il Popover resta montato anche senza selezione: Mantine arma `returnFocus` solo al
  // passaggio false → true, e un popover nato aperto non ne vede mai uno. L'ultima
  // selezione resta mostrata finché non chiude, così `opened` passa da true a false e
  // il focus torna sull'evento.
  const [last, setLast] = useState(selection);
  if (selection !== null && selection !== last) {
    setLast(selection);
  }

  const shown = selection ?? last;
  const item = shown?.item ?? null;
  const rect = shown?.rect ?? null;
  const anchor =
    rect === null
      ? {}
      : {
          pos: "fixed" as const,
          top: `${rect.top}px`,
          left: `${rect.left}px`,
          w: `${rect.width}px`,
          h: `${rect.height}px`,
        };

  return (
    <Popover
      opened={selection !== null}
      onChange={(opened) => {
        if (!opened) {
          onClose();
        }
      }}
      position="bottom-start"
      width={280}
      withinPortal
      trapFocus
      returnFocus
    >
      <Popover.Target>
        <Box key={item?.id ?? "empty"} {...anchor} aria-hidden className={classes.anchor} />
      </Popover.Target>

      <Popover.Dropdown p={0}>
        {item === null ? null : <OccurrenceCard item={item} onClose={onClose} />}
      </Popover.Dropdown>
    </Popover>
  );
}

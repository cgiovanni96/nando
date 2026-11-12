// Contratto wire della vista Inbox: schemi, factory ed esempio.

import { z } from "zod";

import { successEnvelopeSchema } from "../envelope";

export const EXAMPLE_INBOX_ITEM_ID = "0199a4c2-7a10-7000-8000-000000000201";
export const EXAMPLE_TIMESTAMP = "2026-11-11T15:12:23.109Z";

export const listInboxQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const inboxItemDtoSchema = z.object({
  entityType: z.string().min(1),
  id: z.uuid(),
  title: z.string().min(1),
  updatedAt: z.iso.datetime(),
});

export const inboxDataSchema = z.object({
  items: z.array(inboxItemDtoSchema),
  nextCursor: z.string().nullable(),
});

export const inboxResponseSchema = successEnvelopeSchema(inboxDataSchema);

export type InboxItemDto = z.infer<typeof inboxItemDtoSchema>;

export function inboxItemDtoFactory(overrides: Partial<InboxItemDto> = {}): InboxItemDto {
  return inboxItemDtoSchema.parse({
    entityType: "task",
    id: EXAMPLE_INBOX_ITEM_ID,
    title: "Comprare il pane",
    updatedAt: EXAMPLE_TIMESTAMP,
    ...overrides,
  });
}

export const inboxResponseExample = inboxResponseSchema.parse({
  ok: true,
  data: {
    items: [inboxItemDtoFactory()],
    nextCursor: null,
  },
});

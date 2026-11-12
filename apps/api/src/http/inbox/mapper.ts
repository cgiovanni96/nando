// Mapping dominio -> DTO della vista Inbox.

import type { InboxItem } from "@nando/core";

import type { InboxItemDto } from "./contract";

export function toInboxItemDto(item: InboxItem): InboxItemDto {
  return {
    entityType: item.entityType,
    id: item.id,
    title: item.title,
    updatedAt: item.updatedAt.toISOString(),
  };
}

import { Skeleton, Stack } from "@mantine/core";

export function CalendarSkeleton() {
  return (
    <Stack gap="sm">
      <Skeleton height={28} width="70%" radius="sm" />
      <Skeleton height={520} radius="md" />
    </Stack>
  );
}

import { localDateValue } from "@/lib/date-utils";

export function daysUntil(value: string): number {
  return Math.ceil(
    (new Date(`${value}T00:00:00`).getTime() - new Date(`${localDateValue()}T00:00:00`).getTime()) /
      86_400_000,
  );
}

export function formatInventoryDate(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

export function formatInventoryQuantity(value: number): string {
  return value.toLocaleString("en-IN");
}

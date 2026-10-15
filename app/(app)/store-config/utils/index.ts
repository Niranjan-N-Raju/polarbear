import { localDateValue } from "@/lib/date-utils";

export function currentPeriod(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function initialStartDate(): string {
  const date = new Date();
  date.setDate(Math.min(28, Math.max(2, date.getDate())));
  return localDateValue(date);
}

export function startDateFromDay(day: number): string {
  const date = new Date();
  date.setDate(Math.min(28, Math.max(2, day)));
  return localDateValue(date);
}

export function calculatedEndDate(startDate: string): string {
  const start = new Date(`${startDate}T00:00:00`);
  if (Number.isNaN(start.getTime())) return "";
  return localDateValue(new Date(start.getFullYear(), start.getMonth() + 1, start.getDate() - 1));
}

export function formatDate(value: string): string {
  if (!value) return "Select a start date";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(
    new Date(`${value}T00:00:00`),
  );
}

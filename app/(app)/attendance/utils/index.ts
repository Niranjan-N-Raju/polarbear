import type { AttendanceCycleRange, AttendanceStatus } from "@/types/attendance";
import { localDateValue } from "@/lib/date-utils";

export const STATUS_OPTIONS: AttendanceStatus[] = ["Present", "Week Off", "Absent"];
export const statusStyle: Record<AttendanceStatus, string> = {
  Present: "border border-brand-sky bg-brand-sky/10 text-brand-sky",
  "Week Off": "border border-brand-orange bg-brand-peach text-brand-orange",
  Absent: "border border-red-700 bg-red-50 text-red-700",
};
export const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function monthValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function monthStart(value: string) { return new Date(`${value}-01T00:00:00`); }

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

export function monthLabel(value: string) {
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(monthStart(value));
}

export function enumerateDates(from: string, to: string) {
  const dates: string[] = [];
  const current = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  while (current <= end) {
    dates.push(localDateValue(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

export function cycleRangeLabel(cycle: AttendanceCycleRange) {
  if (cycle.type === "calendar_month") return monthLabel(cycle.from.slice(0, 7));
  const fromLabel = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(`${cycle.from}T00:00:00`));
  const toLabel = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${cycle.to}T00:00:00`));
  return `${fromLabel} – ${toLabel}`;
}

export function periodForDate(date: Date, cycleType: "calendar_month" | "custom", startDay: number) {
  if (cycleType === "calendar_month") return monthValue(date);
  const shifted = new Date(date);
  if (date.getDate() >= startDay) shifted.setMonth(shifted.getMonth() + 1);
  return monthValue(shifted);
}

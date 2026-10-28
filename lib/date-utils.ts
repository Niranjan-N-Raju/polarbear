export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** All business-day calculations ("today", current month) use India time regardless of server TZ. */
export const BUSINESS_TIME_ZONE = "Asia/Kolkata";

const businessDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** YYYY-MM-DD of `date` in the business timezone (Asia/Kolkata). */
export function businessDateValue(date: Date = new Date()): string {
  const parts = businessDateFormatter.formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Adds whole days to a YYYY-MM-DD value using UTC arithmetic (no DST/TZ drift). */
export function addDaysToDateValue(value: string, days: number): string {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** Number of calendar days from `from` to `to` inclusive. */
export function inclusiveDayCount(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000) + 1;
}

export function currentMonthRange(now: Date = new Date()): { from: string; to: string } {
  const [year, month] = businessDateValue(now).split("-").map(Number);
  const mm = String(month).padStart(2, "0");
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { from: `${year}-${mm}-01`, to: `${year}-${mm}-${String(lastDay).padStart(2, "0")}` };
}

// Build from local calendar fields instead of toISOString(), which can shift
// local midnight to the previous or next UTC date.
export function localDateValue(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function dateValueFromDate(value: string | Date): string {
  if (typeof value === "string" && DATE_PATTERN.test(value)) return value;
  const date = value instanceof Date ? value : new Date(value);
  return localDateValue(date);
}

export function isValidDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00`);
  return !Number.isNaN(parsed.getTime()) && localDateValue(parsed) === value;
}

export function datesBetween(from: string, to: string): string[] {
  const dates: string[] = [];
  const current = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  while (current <= end) {
    dates.push(localDateValue(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}
/** Earliest accepted year for business records (sales, withdrawals). */
export const MIN_RECORD_YEAR = 2000;

/** Validates a YYYY-MM-DD record date: pattern, year >= 2000 and not after today (Asia/Kolkata). */
export function validateRecordDate(value: unknown): string | null {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return "A valid date is required.";
  if (Number(value.slice(0, 4)) < MIN_RECORD_YEAR) return "A valid date is required.";
  if (value > businessDateValue()) return "Date cannot be in the future.";
  return null;
}

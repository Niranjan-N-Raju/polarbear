import { isValidDate } from "@/lib/date-utils";

export function normalizeProductName(value: string) {
  return value.trim().toLowerCase();
}

export { isValidDate };

export function parsePositiveInteger(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) {
    const parsed = Number(value);
    return parsed > 0 ? parsed : null;
  }
  return null;
}

import { afterEach, describe, it, expect, vi } from "vitest";
import { currentMonthRange, datesBetween, localDateValue } from "@/lib/date-utils";
import { enumerateDates } from "@/app/(app)/attendance/utils";

describe("currentMonthRange", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    [new Date(2024, 1, 15), { from: "2024-02-01", to: "2024-02-29" }],
    [new Date(2026, 1, 15), { from: "2026-02-01", to: "2026-02-28" }],
    [new Date(2026, 11, 31), { from: "2026-12-01", to: "2026-12-31" }],
    [new Date(2027, 0, 1), { from: "2027-01-01", to: "2027-01-31" }],
  ])("returns local month boundaries for %s", (now, expected) => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    expect(currentMonthRange()).toEqual(expected);
  });
});

describe("datesBetween", () => {
  it("preserves the attendance export as the shared implementation", () => {
    expect(enumerateDates).toBe(datesBetween);
  });

  it("includes both endpoints across a leap-day boundary", () => {
    expect(datesBetween("2024-02-28", "2024-03-01")).toEqual([
      "2024-02-28",
      "2024-02-29",
      "2024-03-01",
    ]);
  });

  it("handles a single day and reversed ranges", () => {
    expect(datesBetween("2026-10-16", "2026-10-16")).toEqual(["2026-10-16"]);
    expect(datesBetween("2026-10-17", "2026-10-16")).toEqual([]);
  });

  it("keeps local calendar dates across a daylight-saving boundary", () => {
    expect(datesBetween("2026-03-07", "2026-03-09")).toEqual([
      "2026-03-07",
      "2026-03-08",
      "2026-03-09",
    ]);
    expect(localDateValue(new Date(2026, 9, 16))).toBe("2026-10-16");
  });
});
import { describe, expect, it } from "vitest";
import { salaryAtDate, salaryForDates } from "./salary-history";

describe("effective-dated salary hikes", () => {
  const employee = {
    salary: 6200,
    salaryBaseline: 3100,
    salaryRevisions: [{ effectiveFrom: "2026-01-16", salary: 6200 }],
  };

  it("preserves rates before the effective date", () => {
    expect(salaryAtDate(employee, "2025-12-31")).toBe(3100);
    expect(salaryAtDate(employee, "2026-01-15")).toBe(3100);
    expect(salaryAtDate(employee, "2026-01-16")).toBe(6200);
  });

  it("prorates paid dates and uses the cycle-end rate for undated extra days", () => {
    const dates = Array.from(
      { length: 31 },
      (_, index) => `2026-01-${String(index + 1).padStart(2, "0")}`
    );
    expect(salaryForDates(employee, dates, 0, 31, "2026-01-31")).toBe(4700);
    expect(salaryForDates(employee, dates, 2, 31, "2026-01-31")).toBe(5100);
  });

  it("keeps existing employees without history compatible", () => {
    expect(
      salaryForDates({ salary: 3100 }, ["2026-01-01"], 1, 31, "2026-01-31")
    ).toBe(200);
  });
});

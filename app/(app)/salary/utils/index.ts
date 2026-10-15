export function currentPeriod(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(
    new Date(`${value}T00:00:00`),
  );
}

export function formatDays(value: number): string {
  return `${value} day${value === 1 ? "" : "s"}`;
}

export const INCENTIVE_TYPE_OPTIONS = ["Google Review", "Sales", "Attendance", "Audit", "Other"] as const;
export const EXTRA_DAY_TYPE_OPTIONS = ["Comp Off", "Manual Correction", "Bonus Day", "Other"] as const;
export const ADVANCE_TYPE_OPTIONS = ["Cash Advance", "Emergency", "Loan Repayment", "Other"] as const;

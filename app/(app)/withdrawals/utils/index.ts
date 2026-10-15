import { localDateValue } from "@/lib/date-utils";
import type { WithdrawalForm, WithdrawalRecord } from "@/types/withdrawals";

export const WITHDRAWAL_TYPE_OPTIONS = [
  { value: "withdrawal" as const, label: "Withdrawal" },
  { value: "repayment" as const, label: "Repayment" },
];

export function todayISO(): string {
  return localDateValue();
}

export function currentMonthRange(): { from: string; to: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const from = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const to = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

export function toNumber(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(
    new Date(`${value}T00:00:00`),
  );
}

export function buildEmptyForm(): WithdrawalForm {
  return { date: todayISO(), amount: "", type: "withdrawal", reason: "" };
}

export function buildFormFromRecord(record: WithdrawalRecord): WithdrawalForm {
  return { date: record.date, amount: String(record.amount), type: record.type, reason: record.reason };
}

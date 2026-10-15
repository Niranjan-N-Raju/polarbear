import { localDateValue } from "@/lib/date-utils";
import type { ExpenseItem, SaleForm, SaleRecord } from "@/types/sales";

export function todayISO(): string {
  return localDateValue();
}

export function addOneDay(date: string): string {
  const next = new Date(`${date}T00:00:00`);
  next.setDate(next.getDate() + 1);
  return localDateValue(next);
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

export function todayRange(): { from: string; to: string } {
  const today = todayISO();
  return { from: today, to: today };
}

export function thisWeekRange(): { from: string; to: string } {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay());
  return { from: localDateValue(start), to: todayISO() };
}

export function dayOfMonth(date: string): string {
  const day = Number(date.slice(-2));
  if (day >= 11 && day <= 13) return `${day}th`;
  switch (day % 10) {
    case 1: return `${day}st`;
    case 2: return `${day}nd`;
    case 3: return `${day}rd`;
    default: return `${day}th`;
  }
}

export function formatAmount(value: number): string {
  return value.toFixed(2).replace(/\.?0+$/, "");
}

export function buildEmptyForm(): SaleForm {
  return { date: "", totalSale: "", swiggy: "", zomato: "", upi: "", upiCharge: "" };
}

export function buildFormFromSale(sale: SaleRecord): SaleForm {
  return {
    date: sale.date,
    totalSale: String(sale.totalSale),
    swiggy: String(sale.swiggy),
    zomato: String(sale.zomato),
    upi: String(sale.upi),
    upiCharge: String(sale.upiCharge),
  };
}

export function buildExpenseItemsFromSale(sale: SaleRecord): ExpenseItem[] {
  return sale.expenses.map((expense) => ({ name: expense.name, amount: String(expense.amount) }));
}

export function sanitizeNumericInput(value: string): string {
  const cleaned = value.replaceAll(/[^\d.]/g, "");
  const [whole, ...decimals] = cleaned.split(".");
  return decimals.length > 0 ? `${whole}.${decimals.join("")}` : whole;
}

export function toNumber(value: string): number {
  const num = Number.parseFloat(value);
  return Number.isFinite(num) ? num : 0;
}

import { validateRecordDate } from "@/lib/date-utils";
import { hasAtMostTwoDecimals } from "@/lib/validation";
import type { SalePayload } from "@/types/sales-api";

export interface ValidatedSale {
  date: string;
  totalSale: number;
  swiggy: number;
  zomato: number;
  upi: number;
  upiCharge: number;
  expenses: { name: string; amount: number }[];
}

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && hasAtMostTwoDecimals(value);
}

export function validateSalePayload(body: SalePayload): { value: ValidatedSale } | { error: string } {
  const dateError = validateRecordDate(body.date);
  if (dateError) return { error: dateError };

  for (const field of ["totalSale", "swiggy", "zomato", "upi", "upiCharge"] as const) {
    if (!isFiniteNonNegative(body[field])) return { error: `A valid ${field} is required.` };
  }
  if (!Array.isArray(body.expenses)) {
    return { error: "Expenses must be a list." };
  }
  if (body.expenses.length > 100) return { error: "Too many expense entries." };

  const expenses: { name: string; amount: number }[] = [];
  for (const expense of body.expenses) {
    const name = typeof expense?.name === "string" ? expense.name.trim() : "";
    if (!name || name.length > 100 || !isFiniteNonNegative(expense?.amount)) {
      return { error: "Each expense needs a name and a valid amount." };
    }
    expenses.push({ name, amount: expense.amount });
  }

  return {
    value: {
      date: body.date as string,
      totalSale: body.totalSale as number,
      swiggy: body.swiggy as number,
      zomato: body.zomato as number,
      upi: body.upi as number,
      upiCharge: body.upiCharge as number,
      expenses,
    },
  };
}

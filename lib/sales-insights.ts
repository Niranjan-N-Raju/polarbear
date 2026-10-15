export interface SaleInsightInput {
  date: string;
  totalSale: number;
  swiggy: number;
  zomato: number;
  upi: number;
  cash: number;
  expenses: { name: string; amount: number }[];
}

export interface WeekdayPerformance {
  day: string;
  average: number;
}

export interface ExpenseBreakdownItem {
  name: string;
  amount: number;
}

export interface PaymentMixMonth {
  month: string;
  monthLabel: string;
  onlinePercent: number;
  upiPercent: number;
  cashPercent: number;
}

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Average daily sale for each day of the week, across all provided sales. */
export function computeWeekdayPerformance(sales: SaleInsightInput[]): WeekdayPerformance[] {
  const byWeekday: number[][] = Array.from({ length: 7 }, () => []);
  for (const sale of sales) {
    const day = new Date(`${sale.date}T00:00:00`).getDay();
    byWeekday[day].push(sale.totalSale);
  }
  return WEEKDAY_NAMES.map((name, index) => ({
    day: name,
    average: byWeekday[index].length
      ? Math.round(byWeekday[index].reduce((sum, value) => sum + value, 0) / byWeekday[index].length)
      : 0,
  }));
}

/** Top expense categories by total amount, across all provided sales. */
export function computeExpenseBreakdown(sales: SaleInsightInput[], limit = 8): ExpenseBreakdownItem[] {
  const totals = new Map<string, number>();
  for (const sale of sales) {
    for (const item of sale.expenses ?? []) {
      totals.set(item.name, (totals.get(item.name) ?? 0) + item.amount);
    }
  }
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, amount]) => ({ name, amount: Math.round(amount) }));
}

/** Monthly online/UPI/cash share of total sales, for the last `months` calendar months present in the data. */
export function computePaymentMixTrend(sales: SaleInsightInput[], months = 6): PaymentMixMonth[] {
  const byMonth = new Map<string, { sale: number; online: number; upi: number; cash: number }>();
  for (const sale of sales) {
    const month = sale.date.slice(0, 7);
    const entry = byMonth.get(month) ?? { sale: 0, online: 0, upi: 0, cash: 0 };
    entry.sale += sale.totalSale;
    entry.online += sale.swiggy + sale.zomato;
    entry.upi += sale.upi;
    entry.cash += sale.cash;
    byMonth.set(month, entry);
  }
  return [...byMonth.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-months)
    .map(([month, entry]) => ({
      month,
      monthLabel: new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`)),
      onlinePercent: entry.sale > 0 ? Math.round((entry.online / entry.sale) * 1000) / 10 : 0,
      upiPercent: entry.sale > 0 ? Math.round((entry.upi / entry.sale) * 1000) / 10 : 0,
      cashPercent: entry.sale > 0 ? Math.round((entry.cash / entry.sale) * 1000) / 10 : 0,
    }));
}

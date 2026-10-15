export interface PnlMonth {
  period: string;
  from: string;
  to: string;
  revenue: number;
  netSales: number;
  grossProfit: number;
  salesExpenses: number;
  storeExpenses: number;
  payroll: number;
  totalExpenses: number;
  netProfit: number;
  margin: number;
  swiggyRevenue: number;
  zomatoRevenue: number;
  isCurrent: boolean;
}

export interface PnlData {
  store: { id: string; name: string };
  cycle: { type: "calendar_month" | "custom"; startDay: number };
  months: PnlMonth[];
}

// Manual monthly inputs entered per store/period, keyed by field name (see FIELD_GROUPS).
export interface PnlInputData {
  period: string;
  values: Record<string, number>;
}

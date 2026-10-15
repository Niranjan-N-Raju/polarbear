import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import type { SummaryCardColor } from "@/app/components/SummaryCard";

export interface AttritionMonth {
  month: string;
  monthLabel: string;
  headcount: number;
  leavers: number;
  rate: number;
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

export interface DashboardStats {
  totalStores?: number;
  activeStores?: number;
  inactiveStores?: number;
  franchiseStores?: number;
  companyStores?: number;
  totalUsers?: number;
  storeAdmins?: number;
  subAdmins?: number;
  employees?: number;
  storeCount?: number;
  employeeSummary?: number;
  salesSummary?: number;
  attendanceSummary?: number;
  attritionTrend?: AttritionMonth[];
  weekdayPerformance?: WeekdayPerformance[];
  expenseBreakdown?: ExpenseBreakdownItem[];
  paymentMixTrend?: PaymentMixMonth[];
}

export interface DashboardStatCard {
  label: string;
  value: string | number;
  color: SummaryCardColor;
  icon: IconDefinition;
}

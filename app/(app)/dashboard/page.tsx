"use client";

import { useEffect } from "react";
import { DatePicker } from "@/app/components/DatePicker";
import { localDateValue } from "@/lib/date-utils";
import { DashboardCards } from "./components/DashboardCards";
import { SalesTrendChart } from "./components/SalesTrendChart";
import { AttritionChart } from "./components/AttritionChart";
import { WeekdayPerformanceChart } from "./components/WeekdayPerformanceChart";
import { ExpenseBreakdownChart } from "./components/ExpenseBreakdownChart";
import { PaymentMixChart } from "./components/PaymentMixChart";
import { useDashboardData } from "./hooks/useDashboardData";

export default function DashboardPage() {
  useEffect(() => { document.title = "Dashboard · Polar Bear"; }, []);
  const dashboard = useDashboardData();
  const {
    activeStoreId,
    stats,
    loading,
    hasError,
    dailySales,
    dateFrom,
    dateTo,
    setDateFrom,
    setDateTo,
    isFranchiseAdmin,
    resetToThisWeek,
    resetToCurrentMonth,
  } = dashboard;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-brand-beige bg-white/80 p-6 shadow-[0_10px_30px_rgba(36,50,58,0.05)]">
        <div>
          <p className="hidden text-xs font-semibold uppercase tracking-[0.18em] text-brand-orange sm:block">Operations overview</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-gray-900">Dashboard</h2>
          <p className="mt-2 text-sm text-gray-500">A clear view of the work happening across your stores.</p>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-brand-orange border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && !hasError && stats !== null && (
        <DashboardCards stats={stats} isFranchiseAdmin={isFranchiseAdmin} />
      )}

      {!loading && !hasError && isFranchiseAdmin && activeStoreId && (
        <div className="relative rounded-xl border border-gray-200 border-t-[3px] border-t-brand-teal bg-white p-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-gray-500">Sales Trend</p>
              <div className="mt-2 flex flex-wrap items-end gap-3">
                <div>
                  <label htmlFor="dashboard-filter-from" className="block text-xs font-medium text-gray-500 mb-1">
                    From
                  </label>
                  <DatePicker
                    id="dashboard-filter-from"
                    value={dateFrom}
                    max={dateTo}
                    onChange={setDateFrom}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-brand-orange focus:border-brand-orange transition"
                  />
                </div>
                <div>
                  <label htmlFor="dashboard-filter-to" className="block text-xs font-medium text-gray-500 mb-1">
                    To
                  </label>
                  <DatePicker
                    id="dashboard-filter-to"
                    value={dateTo}
                    min={dateFrom}
                    max={localDateValue()}
                    onChange={setDateTo}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-brand-orange focus:border-brand-orange transition"
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={resetToThisWeek}
                className="rounded-lg border border-brand-sky px-4 py-2 text-sm font-medium text-brand-sky hover:bg-brand-sky/10 transition"
              >
                This Week
              </button>
              <button
                type="button"
                onClick={resetToCurrentMonth}
                className="rounded-lg border border-brand-sky px-4 py-2 text-sm font-medium text-brand-sky hover:bg-brand-sky/10 transition"
              >
                This Month
              </button>
            </div>
          </div>
          {dateFrom > dateTo ? (
            <p className="mt-4 text-xs text-red-600">From date must be before the To date.</p>
          ) : (
            <SalesTrendChart sales={dailySales} dateFrom={dateFrom} dateTo={dateTo} />
          )}
        </div>
      )}

      {!loading && !hasError && isFranchiseAdmin && activeStoreId && stats?.attritionTrend && (
        <div className="relative rounded-xl border border-gray-200 border-t-[3px] border-t-brand-orange bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-gray-500">Employee Attrition Rate</p>
          <p className="mt-1 text-xs text-gray-400">Employees who left each month vs. headcount at the start of that month · last 6 months</p>
          {stats.attritionTrend.every((month) => month.headcount === 0) ? (
            <p className="mt-4 text-sm text-gray-500">No employee history yet for this store.</p>
          ) : (
            <AttritionChart trend={stats.attritionTrend} />
          )}
        </div>
      )}

      {!loading && !hasError && isFranchiseAdmin && activeStoreId && stats?.weekdayPerformance && (
        <div className="relative rounded-xl border border-gray-200 border-t-[3px] border-t-brand-teal bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-gray-500">Sales by Day of Week</p>
          <p className="mt-1 text-xs text-gray-400">Average daily sale for each weekday, across all recorded sales</p>
          {stats.weekdayPerformance.every((day) => day.average === 0) ? (
            <p className="mt-4 text-sm text-gray-500">No sales history yet for this store.</p>
          ) : (
            <WeekdayPerformanceChart data={stats.weekdayPerformance} />
          )}
        </div>
      )}

      {!loading && !hasError && isFranchiseAdmin && activeStoreId && stats?.expenseBreakdown && (
        <div className="relative rounded-xl border border-gray-200 border-t-[3px] border-t-brand-orange bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-gray-500">Top Expense Categories</p>
          <p className="mt-1 text-xs text-gray-400">Highest-spend expense categories, across all recorded sales</p>
          {stats.expenseBreakdown.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500">No expenses recorded yet for this store.</p>
          ) : (
            <ExpenseBreakdownChart items={stats.expenseBreakdown} />
          )}
        </div>
      )}

      {!loading && !hasError && isFranchiseAdmin && activeStoreId && stats?.paymentMixTrend && (
        <div className="relative rounded-xl border border-gray-200 border-t-[3px] border-t-brand-teal bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-gray-500">Payment Mix Trend</p>
          <p className="mt-1 text-xs text-gray-400">Online vs UPI vs cash share of sales · last 6 months</p>
          {stats.paymentMixTrend.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500">No sales history yet for this store.</p>
          ) : (
            <PaymentMixChart trend={stats.paymentMixTrend} />
          )}
        </div>
      )}

    </div>
  );
}

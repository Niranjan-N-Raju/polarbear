"use client";

import { useCallback, useEffect, useState } from "react";
import {
  faIndianRupeeSign,
  faCreditCard,
  faPercent,
  faReceipt,
  faMoneyBillWave,
} from "@fortawesome/free-solid-svg-icons";
import { PencilIcon } from "@/app/components/icons";
import { SummaryCard } from "@/app/components/SummaryCard";
import { MobileSummaryDrawer } from "@/app/components/MobileSummaryDrawer";
import { DatePicker } from "@/app/components/DatePicker";
import { useToast } from "@/app/hooks/useToast";
import { useStoreModal } from "@/app/(app)/store-context";
import type { SaleRecord } from "@/types/sales";
import { salesRequest } from "./apicall/sales";
import {
  currentMonthRange,
  dayOfMonth,
  formatAmount,
  thisWeekRange,
  todayISO,
  todayRange,
} from "./utils";
import { SaleExpensesCell } from "./components/SaleExpensesCell";
import { SaleFormDrawer } from "./components/SaleFormDrawer";

export default function SalesPage() {
  const { activeStoreId } = useStoreModal();
  useEffect(() => { document.title = "Sales · Polar Bear"; }, []);
  const { error } = useToast();
  const [showAddSale, setShowAddSale] = useState(false);
  const [editingSale, setEditingSale] = useState<SaleRecord | null>(null);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(() => currentMonthRange().from);
  const [dateTo, setDateTo] = useState(() => currentMonthRange().to);
  const [dateRangeError, setDateRangeError] = useState<string | undefined>();

  const loadSales = useCallback(async () => {
    if (!activeStoreId) {
      setSales([]);
      setLoading(false);
      return;
    }
    if (dateFrom > dateTo) {
      setDateRangeError("From date must be before the To date.");
      return;
    }
    setDateRangeError(undefined);
    setLoading(true);
    try {
      const response = await salesRequest(
        `/api/sales?franchiseId=${encodeURIComponent(activeStoreId)}&from=${dateFrom}&to=${dateTo}`,
      );
      const data = (await response.json()) as { sales?: SaleRecord[]; message?: string };
      if (!response.ok) throw new Error(data.message ?? "Failed to load sales.");
      setSales(data.sales ?? []);
    } catch (loadError) {
      error(loadError instanceof Error ? loadError.message : "Failed to load sales.");
    } finally {
      setLoading(false);
    }
  }, [activeStoreId, dateFrom, dateTo, error]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadSales();
    });
  }, [loadSales]);

  function resetToCurrentMonth() {
    const { from, to } = currentMonthRange();
    setDateFrom(from);
    setDateTo(to);
  }

  function resetToToday() {
    const { from, to } = todayRange();
    setDateFrom(from);
    setDateTo(to);
  }

  function resetToThisWeek() {
    const { from, to } = thisWeekRange();
    setDateFrom(from);
    setDateTo(to);
  }

  const totalOnlineSales = sales.reduce((sum, sale) => sum + sale.swiggy + sale.zomato, 0);
  const totals = sales.reduce(
    (acc, sale) => ({
      totalSale: acc.totalSale + sale.totalSale,
      swiggy: acc.swiggy + sale.swiggy,
      zomato: acc.zomato + sale.zomato,
      upi: acc.upi + sale.upi,
      upiCharge: acc.upiCharge + sale.upiCharge,
      cash: acc.cash + sale.cash,
      expenses: acc.expenses + sale.expenses.reduce((sum, item) => sum + item.amount, 0),
      bankingCash: acc.bankingCash + sale.bankingCash,
    }),
    { totalSale: 0, swiggy: 0, zomato: 0, upi: 0, upiCharge: 0, cash: 0, expenses: 0, bankingCash: 0 },
  );
  const totalOnlinePercent = totals.totalSale > 0 ? ((totals.swiggy + totals.zomato) / totals.totalSale) * 100 : 0;
  const summaryCards = [
    { label: "Total Sales", value: formatAmount(totals.totalSale), color: "teal" as const, icon: faIndianRupeeSign },
    { label: "Online Sales", value: formatAmount(totalOnlineSales), color: "orange" as const, icon: faCreditCard },
    {
      label: "Online %",
      value: totals.totalSale > 0 ? `${formatAmount(totalOnlinePercent)}%` : "-",
      color: "orange" as const,
      icon: faPercent,
    },
    { label: "Total Expenses", value: formatAmount(totals.expenses), color: "teal" as const, icon: faReceipt },
    { label: "Banking Cash", value: formatAmount(totals.bankingCash), color: "teal" as const, icon: faMoneyBillWave },
  ];

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-brand-beige bg-white/80 p-6 shadow-[0_10px_30px_rgba(36,50,58,0.05)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="hidden text-xs font-semibold uppercase tracking-[0.18em] text-brand-orange sm:block">Commercial overview</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-gray-900">Sales</h2>
            <p className="mt-2 text-sm text-gray-500">Deal pipeline overview</p>
          </div>
          <button
            type="button"
            onClick={() => setShowAddSale(true)}
            className="bg-brand-orange text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-brand-orange/90 transition"
          >
            + Add Sale
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-brand-beige bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label htmlFor="filter-from" className="block text-xs font-medium text-gray-500 mb-1">
              From
            </label>
            <DatePicker
              id="filter-from"
              value={dateFrom}
              max={dateTo}
              onChange={setDateFrom}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-brand-orange focus:border-brand-orange transition"
            />
          </div>
          <div>
            <label htmlFor="filter-to" className="block text-xs font-medium text-gray-500 mb-1">
              To
            </label>
            <DatePicker
              id="filter-to"
              value={dateTo}
              min={dateFrom}
              max={todayISO()}
              onChange={setDateTo}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-brand-orange focus:border-brand-orange transition"
            />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={resetToToday}
              className="flex items-center justify-center rounded-lg border border-brand-sky px-4 py-2 text-sm font-medium text-brand-sky hover:bg-brand-sky/10 transition"
            >
              Today
            </button>
            <button
              type="button"
              onClick={resetToThisWeek}
              className="flex items-center justify-center rounded-lg border border-brand-sky px-4 py-2 text-sm font-medium text-brand-sky hover:bg-brand-sky/10 transition"
            >
              This Week
            </button>
            <button
              type="button"
              onClick={resetToCurrentMonth}
              className="flex items-center justify-center rounded-lg border border-brand-sky px-4 py-2 text-sm font-medium text-brand-sky hover:bg-brand-sky/10 transition"
            >
              This Month
            </button>
          </div>
        </div>
        {dateRangeError && (
          <p className="mt-2 text-xs text-red-600" role="alert">
            {dateRangeError}
          </p>
        )}
      </div>

      <div className="hidden gap-3 sm:grid sm:grid-cols-3 lg:grid-cols-5">
        {summaryCards.map((card) => (
          <SummaryCard key={card.label} label={card.label} value={card.value} color={card.color} icon={card.icon} />
        ))}
      </div>
      <MobileSummaryDrawer cards={summaryCards} />

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-brand-orange border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && sales.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400 text-sm">
          No sales recorded yet.
        </div>
      )}

      {!loading && sales.length > 0 && (
        <div className="bg-white rounded-2xl border border-brand-beige shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-brand-sand/50 border-b border-brand-beige">
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Date</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Total Sale</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Swiggy</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Zomato</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Online %</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">UPI</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">UPI Charge</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Cash</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Expenses</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Banking Cash</th>
                  <th className="px-5 py-3" />
                </tr>
                <tr className="bg-brand-sand/80 border-b border-brand-beige">
                  <th className="text-left px-5 py-2.5 font-semibold text-gray-900">Total</th>
                  <th className="text-left px-5 py-2.5 font-semibold text-gray-900">{formatAmount(totals.totalSale)}</th>
                  <th className="text-left px-5 py-2.5 font-semibold text-gray-900">{formatAmount(totals.swiggy)}</th>
                  <th className="text-left px-5 py-2.5 font-semibold text-gray-900">{formatAmount(totals.zomato)}</th>
                  <th className="text-left px-5 py-2.5 font-semibold text-gray-900">
                    {totals.totalSale > 0 ? `${formatAmount(totalOnlinePercent)}%` : "-"}
                  </th>
                  <th className="text-left px-5 py-2.5 font-semibold text-gray-900">{formatAmount(totals.upi)}</th>
                  <th className="text-left px-5 py-2.5 font-semibold text-gray-900">{formatAmount(totals.upiCharge)}</th>
                  <th className="text-left px-5 py-2.5 font-semibold text-gray-900">{formatAmount(totals.cash)}</th>
                  <th className="text-left px-5 py-2.5 font-semibold text-gray-900">{formatAmount(totals.expenses)}</th>
                  <th className="text-left px-5 py-2.5 font-semibold text-gray-900">{formatAmount(totals.bankingCash)}</th>
                  <th className="px-5 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-beige/60">
                {sales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-brand-sand/20 transition">
                    <td className="px-5 py-3.5 font-medium text-gray-900">{dayOfMonth(sale.date)}</td>
                    <td className="px-5 py-3.5 text-gray-600">{formatAmount(sale.totalSale)}</td>
                    <td className="px-5 py-3.5 text-gray-600">{formatAmount(sale.swiggy)}</td>
                    <td className="px-5 py-3.5 text-gray-600">{formatAmount(sale.zomato)}</td>
                    <td className="px-5 py-3.5 text-gray-600">
                      {sale.totalSale > 0
                        ? `${formatAmount(((sale.swiggy + sale.zomato) / sale.totalSale) * 100)}%`
                        : "-"}
                    </td>
                    <td className="px-5 py-3.5 text-gray-600">{formatAmount(sale.upi)}</td>
                    <td className="px-5 py-3.5 text-gray-600">{formatAmount(sale.upiCharge)}</td>
                    <td className="px-5 py-3.5 text-gray-600">{formatAmount(sale.cash)}</td>
                    <td className="px-5 py-3.5 text-gray-600">
                      <SaleExpensesCell expenses={sale.expenses} />
                    </td>
                    <td className="px-5 py-3.5 text-gray-600">{formatAmount(sale.bankingCash)}</td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => setEditingSale(sale)}
                        aria-label={`Edit sale on ${sale.date}`}
                        className="text-gray-400 hover:text-brand-orange transition"
                      >
                        <PencilIcon className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showAddSale && (
        <SaleFormDrawer
          existingDates={sales.map((sale) => sale.date)}
          onClose={() => setShowAddSale(false)}
          onSaved={() => {
            setShowAddSale(false);
            void loadSales();
          }}
        />
      )}

      {editingSale && (
        <SaleFormDrawer
          editSale={editingSale}
          existingDates={sales.filter((sale) => sale.id !== editingSale.id).map((sale) => sale.date)}
          onClose={() => setEditingSale(null)}
          onSaved={() => {
            setEditingSale(null);
            void loadSales();
          }}
        />
      )}
    </div>
  );
}

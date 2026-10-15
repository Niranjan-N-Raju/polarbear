"use client";

import { useCallback, useEffect, useState } from "react";
import {
  faIndianRupeeSign,
  faReceipt,
  faUsers,
  faChartLine,
} from "@fortawesome/free-solid-svg-icons";
import { useStoreModal } from "@/app/(app)/store-context";
import { useToast } from "@/app/hooks/useToast";
import { SummaryCard } from "@/app/components/SummaryCard";
import { MobileSummaryDrawer } from "@/app/components/MobileSummaryDrawer";
import type { PnlData, PnlMonth } from "@/types/pnl";
import { pnlRequest } from "../apicall/pnl";
import { formatCurrency, formatPercent, formatPeriodLabel, formatRangeLabel } from "../utils";
import { PnlMonthDrawer } from "./PnlMonthDrawer";

export default function PnlPage() {
  const { activeStoreId } = useStoreModal();
  useEffect(() => { document.title = "P&L · Polar Bear"; }, []);
  const { error } = useToast();
  const [data, setData] = useState<PnlData | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMonth, setViewMonth] = useState<PnlMonth | null>(null);

  const loadPnl = useCallback(async () => {
    if (!activeStoreId) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await pnlRequest(`/api/pnl?franchiseId=${encodeURIComponent(activeStoreId)}`);
      const result = (await response.json()) as PnlData & { message?: string };
      if (!response.ok) throw new Error(result.message ?? "Failed to load P&L data.");
      setData(result);
      setViewMonth((current) =>
        current ? result.months.find((month) => month.period === current.period) ?? current : null,
      );
    } catch (loadError) {
      error(loadError instanceof Error ? loadError.message : "Failed to load P&L data.");
    } finally {
      setLoading(false);
    }
  }, [activeStoreId, error]);

  useEffect(() => {
    queueMicrotask(() => void loadPnl());
  }, [loadPnl]);

  const months = data?.months ?? [];
  const latest = months.find((month) => month.isCurrent) ?? months[0];

  const summaryCards = latest
    ? [
        { label: "Revenue", value: formatCurrency(latest.revenue), color: "teal" as const, icon: faIndianRupeeSign, subtitle: formatPeriodLabel(latest.period) },
        { label: "Store Expenses", value: formatCurrency(latest.storeExpenses), color: "orange" as const, icon: faReceipt, subtitle: formatPeriodLabel(latest.period) },
        { label: "Payroll", value: formatCurrency(latest.payroll), color: "orange" as const, icon: faUsers, subtitle: formatPeriodLabel(latest.period) },
        { label: "Net Profit", value: formatCurrency(latest.netProfit), color: latest.netProfit >= 0 ? ("teal" as const) : ("yellow" as const), icon: faChartLine, subtitle: `${formatPercent(latest.margin)} margin` },
      ]
    : [];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-brand-beige bg-white/80 p-6 shadow-[0_10px_30px_rgba(36,50,58,0.05)]">
        <div>
          <p className="hidden text-xs font-semibold uppercase tracking-[0.18em] text-brand-orange sm:block">
            Business operations
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-gray-900">
            Profit &amp; Loss
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            Revenue, expenses and payroll cost, broken down month by month.
          </p>
        </div>
      </div>

      {!activeStoreId ? (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-500">
          Select a store to view P&amp;L.
        </div>
      ) : loading ? (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-500">
          Loading…
        </div>
      ) : months.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-500">
          No sales recorded yet for this store.
        </div>
      ) : (
        <>
          <div className="hidden gap-3 sm:grid sm:grid-cols-4 sm:gap-4">
            {summaryCards.map((card) => (
              <SummaryCard
                key={card.label}
                label={card.label}
                value={card.value}
                color={card.color}
                icon={card.icon}
                subtitle={card.subtitle}
              />
            ))}
          </div>
          <MobileSummaryDrawer cards={summaryCards} title="P&L Summary" />

          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-[0_10px_30px_rgba(36,50,58,0.05)]">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-brand-sand/60 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3">Month</th>
                  <th className="px-4 py-3 text-right">Revenue</th>
                  <th className="px-4 py-3 text-right">Store Expenses</th>
                  <th className="px-4 py-3 text-right">Payroll</th>
                  <th className="px-4 py-3 text-right">Total Expenses</th>
                  <th className="px-4 py-3 text-right">Net Profit</th>
                  <th className="px-4 py-3 text-right">Margin</th>
                  <th className="px-4 py-3 text-right"> </th>
                </tr>
              </thead>
              <tbody>
                {months.map((month) => (
                  <tr
                    key={month.period}
                    className={`border-b border-gray-100 last:border-0 ${month.isCurrent ? "bg-brand-teal/5" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{formatPeriodLabel(month.period)}</p>
                      <p className="text-xs text-gray-500">{formatRangeLabel(month.from, month.to)}</p>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(month.revenue)}</td>
                    <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(month.storeExpenses)}</td>
                    <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(month.payroll)}</td>
                    <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(month.totalExpenses)}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${month.netProfit >= 0 ? "text-brand-teal" : "text-red-600"}`}>
                      {formatCurrency(month.netProfit)}
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${month.netProfit >= 0 ? "text-brand-teal" : "text-red-600"}`}>
                      {formatPercent(month.margin)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setViewMonth(month)}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-brand-sand"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {viewMonth && activeStoreId && (
        <PnlMonthDrawer
          month={viewMonth}
          franchiseId={activeStoreId}
          onClose={() => setViewMonth(null)}
          onSaved={() => void loadPnl()}
        />
      )}
    </div>
  );
}

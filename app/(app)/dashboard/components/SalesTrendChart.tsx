"use client";

import { datesBetween } from "@/lib/date-utils";
import type { DailySale } from "@/types/sales";

interface SalesTrendChartProps {
  sales: DailySale[];
  dateFrom: string;
  dateTo: string;
}

export function SalesTrendChart({ sales, dateFrom, dateTo }: Readonly<SalesTrendChartProps>) {
  const byDate = new Map(sales.map((sale) => [sale.date, sale.totalSale]));
  const dates = datesBetween(dateFrom, dateTo);
  const maxValue = Math.max(1, ...dates.map((date) => byDate.get(date) ?? 0));

  return (
    <div className="mt-6 flex items-end gap-1 overflow-x-auto pb-1 pt-8">
      {dates.map((date) => {
        const value = byDate.get(date) ?? 0;
        const heightPercent = Math.max(2, (value / maxValue) * 100);
        const day = Number(date.slice(-2));
        return (
          <div key={date} className="flex min-w-[10px] flex-1 flex-col items-center gap-1">
            <div className="group relative flex h-32 w-full items-end">
              <div
                className={`w-full ${value > 0 ? "bg-brand-teal" : "bg-gray-100"}`}
                style={{ height: `${heightPercent}%` }}
              />
              <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-[10px] font-medium text-white shadow-[0_8px_20px_rgba(0,0,0,0.35)] group-hover:block">
                {new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(`${date}T00:00:00`))}
                : ₹{value.toLocaleString("en-IN")}
              </span>
            </div>
            <span className="h-3 text-[10px] leading-3 text-gray-400">
              {dates.length <= 8 || day === 1 || day % 5 === 0 || date === dates[dates.length - 1] ? day : "\u00A0"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

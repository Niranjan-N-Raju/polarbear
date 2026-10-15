"use client";

import type { AttritionMonth } from "@/types/dashboard";

interface AttritionChartProps {
  trend: AttritionMonth[];
}

export function AttritionChart({ trend }: Readonly<AttritionChartProps>) {
  const maxRate = Math.max(1, ...trend.map((month) => month.rate));

  return (
    <div className="mt-6 flex items-end gap-4 overflow-x-auto pb-1 pt-8">
      {trend.map((month) => {
        const heightPercent = Math.max(2, (month.rate / maxRate) * 100);
        return (
          <div key={month.month} className="flex min-w-[48px] flex-1 flex-col items-center gap-2">
            <div className="group relative flex h-32 w-full items-end justify-center">
              <div
                className={`w-8 ${month.rate > 0 ? "bg-brand-orange" : "bg-gray-100"}`}
                style={{ height: `${heightPercent}%` }}
              />
              <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-[10px] font-medium text-white shadow-[0_8px_20px_rgba(0,0,0,0.35)] group-hover:block">
                {month.leavers} left / {month.headcount} headcount: {month.rate}%
              </span>
            </div>
            <span className="text-[11px] font-medium text-gray-500">{month.rate}%</span>
            <span className="text-[10px] text-gray-400">{month.monthLabel}</span>
          </div>
        );
      })}
    </div>
  );
}

"use client";

import type { WeekdayPerformance } from "@/types/dashboard";

interface WeekdayPerformanceChartProps {
  data: WeekdayPerformance[];
}

export function WeekdayPerformanceChart({ data }: Readonly<WeekdayPerformanceChartProps>) {
  const maxAverage = Math.max(1, ...data.map((day) => day.average));

  return (
    <div className="mt-6 flex items-end gap-3 overflow-x-auto pb-1 pt-8">
      {data.map((day) => {
        const heightPercent = Math.max(2, (day.average / maxAverage) * 100);
        return (
          <div key={day.day} className="flex min-w-[40px] flex-1 flex-col items-center gap-2">
            <div className="group relative flex h-32 w-full items-end justify-center">
              <div
                className={`w-8 ${day.average > 0 ? "bg-brand-teal" : "bg-gray-100"}`}
                style={{ height: `${heightPercent}%` }}
              />
              <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-[10px] font-medium text-white shadow-[0_8px_20px_rgba(0,0,0,0.35)] group-hover:block">
                ₹{day.average.toLocaleString("en-IN")} avg
              </span>
            </div>
            <span className="text-[10px] text-gray-400">{day.day}</span>
          </div>
        );
      })}
    </div>
  );
}

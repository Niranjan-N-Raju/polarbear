"use client";

import type { PaymentMixMonth } from "@/types/dashboard";

interface PaymentMixChartProps {
  trend: PaymentMixMonth[];
}

export function PaymentMixChart({ trend }: Readonly<PaymentMixChartProps>) {
  const maxPercent = Math.max(1, ...trend.flatMap((month) => [month.onlinePercent, month.upiPercent, month.cashPercent]));

  return (
    <div>
      <div className="mb-3 flex items-center gap-4 text-[11px] text-gray-500">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 bg-brand-teal" />Online</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 bg-brand-sky" />UPI</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 bg-brand-orange" />Cash</span>
      </div>
      <div className="flex items-end gap-4 overflow-x-auto pb-1 pt-4">
        {trend.map((month) => (
          <div key={month.month} className="flex min-w-[64px] flex-1 flex-col items-center gap-2">
            <div className="group relative flex h-32 w-full items-end justify-center gap-1">
              <div className="w-3 bg-brand-teal" style={{ height: `${Math.max(2, (month.onlinePercent / maxPercent) * 100)}%` }} />
              <div className="w-3 bg-brand-sky" style={{ height: `${Math.max(2, (month.upiPercent / maxPercent) * 100)}%` }} />
              <div className="w-3 bg-brand-orange" style={{ height: `${Math.max(2, (month.cashPercent / maxPercent) * 100)}%` }} />
              <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-[10px] font-medium text-white shadow-[0_8px_20px_rgba(0,0,0,0.35)] group-hover:block">
                Online {month.onlinePercent}% · UPI {month.upiPercent}% · Cash {month.cashPercent}%
              </span>
            </div>
            <span className="text-[10px] text-gray-400">{month.monthLabel}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

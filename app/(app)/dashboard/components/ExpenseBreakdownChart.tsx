"use client";

import type { ExpenseBreakdownItem } from "@/types/dashboard";

interface ExpenseBreakdownChartProps {
  items: ExpenseBreakdownItem[];
}

export function ExpenseBreakdownChart({ items }: Readonly<ExpenseBreakdownChartProps>) {
  const maxAmount = Math.max(1, ...items.map((item) => item.amount));

  return (
    <div className="mt-6 space-y-3">
      {items.map((item) => {
        const widthPercent = Math.max(2, (item.amount / maxAmount) * 100);
        return (
          <div key={item.name} className="flex items-center gap-3">
            <span className="w-28 shrink-0 truncate text-xs font-medium text-gray-600" title={item.name}>
              {item.name}
            </span>
            <div className="h-3 flex-1 bg-gray-100">
              <div className="h-full bg-brand-orange" style={{ width: `${widthPercent}%` }} />
            </div>
            <span className="w-20 shrink-0 text-right text-xs font-semibold text-gray-700">₹{item.amount.toLocaleString("en-IN")}</span>
          </div>
        );
      })}
    </div>
  );
}

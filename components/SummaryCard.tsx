"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";

export type SummaryCardColor = "teal" | "orange" | "yellow";

const COLOR_CLASSES: Record<SummaryCardColor, { text: string; border: string; hex: string }> = {
  teal: { text: "text-brand-teal", border: "border-brand-teal", hex: "#00a2c0" },
  orange: { text: "text-brand-orange", border: "border-brand-orange", hex: "#f47521" },
  yellow: { text: "text-brand-yellow", border: "border-brand-yellow", hex: "#ffd44f" },
};

export interface SummaryCardProps {
  label: string;
  value: string | number;
  icon: IconDefinition;
  color: SummaryCardColor;
  subtitle?: string;
  onClick?: () => void;
  highlight?: boolean;
}

export function SummaryCard({
  label,
  value,
  icon,
  color,
  subtitle,
  onClick,
  highlight = false,
}: Readonly<SummaryCardProps>) {
  const { text, border, hex } = COLOR_CLASSES[color];
  const Wrapper = onClick ? "button" : "div";

  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      // Inline style guarantees the top border wins over the all-sides border-gray-200 utility.
      style={{ borderTopWidth: "3px", borderTopColor: hex }}
      className={`relative w-full rounded-xl border border-gray-200 bg-white p-3 text-left sm:p-4 ${
        highlight ? "inventory-urgent-blink motion-reduce:animate-none ring-2 ring-brand-yellow" : ""
      }`}
    >
      <span
        className={`absolute right-3 top-3 flex h-8 w-8 items-center justify-center border-t-2 ${border} ${text} bg-brand-sand text-sm sm:right-4 sm:top-4 sm:h-10 sm:w-10 sm:text-base`}
      >
        <FontAwesomeIcon icon={icon} />
      </span>
      <p className="pr-9 text-[11px] font-bold uppercase tracking-[0.1em] text-gray-500 sm:pr-0 sm:text-xs">{label}</p>
      <p className={`mt-2 text-lg font-bold ${text} sm:mt-3 sm:text-2xl`}>{value}</p>
      {subtitle && <p className="mt-2 text-xs text-gray-500 sm:mt-3">{subtitle}</p>}
    </Wrapper>
  );
}

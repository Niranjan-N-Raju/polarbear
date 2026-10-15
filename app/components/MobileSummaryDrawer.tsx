"use client";

import { useState } from "react";
import { faChartSimple } from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { SummaryCard, type SummaryCardColor } from "@/app/components/SummaryCard";
import { OutlineCloseIcon } from "@/app/components/icons";
import { useDrawerVisibility } from "@/app/hooks/useDrawerClose";

export interface MobileSummaryCardItem {
  label: string;
  value: string | number;
  color: SummaryCardColor;
  icon: IconDefinition;
  subtitle?: string;
  onClick?: () => void;
  highlight?: boolean;
}

// Mobile-only floating "View Summary" button that opens a bottom sheet with the summary cards.
export function MobileSummaryDrawer({
  cards,
  title = "Summary",
}: Readonly<{ cards: MobileSummaryCardItem[]; title?: string }>) {
  const [open, setOpen] = useState(false);
  const { shouldRender, visible } = useDrawerVisibility(open);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-30 flex items-center gap-2 bg-brand-orange px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_25px_rgba(244,117,33,0.35)] transition hover:bg-brand-orange/90 sm:hidden"
      >
        <FontAwesomeIcon icon={faChartSimple} />
        View Summary
      </button>

      {shouldRender && (
        <>
          <div
            className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 sm:hidden ${visible ? "opacity-100" : "opacity-0"}`}
            aria-hidden="true"
            onClick={() => setOpen(false)}
            style={{ height: "100vh" }}
          />
          <div
            className={`fixed inset-x-0 z-50 flex flex-col bg-white shadow-2xl transition-transform duration-200 ease-out sm:hidden ${
              visible ? "translate-y-0" : "translate-y-full"
            }`}
            style={{ top: "50vh", height: "50vh" }}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-brand-beige px-5 py-4">
              <h3 className="text-base font-bold text-gray-900">{title}</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition hover:bg-brand-sand"
              >
                <OutlineCloseIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="grid flex-1 grid-cols-2 content-start gap-3 overflow-y-auto p-5">
              {cards.map((card) => (
                <SummaryCard
                  key={card.label}
                  label={card.label}
                  value={card.value}
                  color={card.color}
                  icon={card.icon}
                  subtitle={card.subtitle}
                  highlight={card.highlight}
                  onClick={card.onClick ? () => { card.onClick?.(); setOpen(false); } : undefined}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}

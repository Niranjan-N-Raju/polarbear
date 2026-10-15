"use client";

import { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCalendarDay } from "@fortawesome/free-solid-svg-icons";

interface MonthPickerProps {
  value: string;
  onChange: (value: string) => void;
}

const MONTHS = Array.from({ length: 12 }, (_, month) =>
  new Intl.DateTimeFormat("en-IN", { month: "short" }).format(new Date(2026, month, 1)),
);

export function MonthPicker({ value, onChange }: Readonly<MonthPickerProps>) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(() => Number(value.slice(0, 4)));
  const containerRef = useRef<HTMLDivElement | null>(null);
  const selectedYear = Number(value.slice(0, 4));
  const selectedMonth = Number(value.slice(5, 7)) - 1;
  const yearOptions = Array.from({ length: 41 }, (_, index) => new Date().getFullYear() - 20 + index);
  const displayValue = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(
    new Date(selectedYear, selectedMonth, 1),
  );

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (event.target instanceof Node && !containerRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function openPicker() {
    setYear(selectedYear);
    setOpen((current) => !current);
  }

  function selectMonth(month: number) {
    onChange(`${year}-${String(month + 1).padStart(2, "0")}`);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={openPicker}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-left text-sm text-gray-900 transition focus:border-brand-orange focus:outline-none focus:ring-2 focus:ring-brand-orange/20"
      >
        <span>{displayValue}</span>
        <FontAwesomeIcon icon={faCalendarDay} className="h-3.5 w-3.5 shrink-0 text-brand-orange" />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Choose month"
          className="absolute left-0 top-full z-50 mt-1 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-brand-beige bg-white p-3 shadow-[0_20px_45px_rgba(36,50,58,0.25)]"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-gray-900">Select month</span>
            <select
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
              aria-label="Select year"
              className="rounded-md border border-brand-beige bg-white px-2 py-1 text-sm font-medium text-gray-900 focus:border-brand-orange focus:outline-none"
            >
              {yearOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {MONTHS.map((monthName, month) => {
              const selected = year === selectedYear && month === selectedMonth;
              return (
                <button
                  key={monthName}
                  type="button"
                  onClick={() => selectMonth(month)}
                  aria-pressed={selected}
                  className={`rounded-md px-2 py-2 text-sm font-medium transition ${
                    selected
                      ? "bg-brand-orange text-white"
                      : "text-gray-700 hover:bg-brand-peach hover:text-brand-orange"
                  }`}
                >
                  {monthName}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCalendarDay } from "@fortawesome/free-solid-svg-icons";

interface DatePickerProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  max?: string;
  min?: string;
  disabledDates?: string[];
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
  className?: string;
  placeholder?: string;
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function toISO(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function parseISO(value: string): { year: number; month: number; day: number } {
  const [year, month, day] = value.split("-").map(Number);
  return { year, month: month - 1, day };
}

/** Date picker with per-day disabling, since native <input type="date"> can't grey out individual dates. */
export function DatePicker({
  id,
  value,
  onChange,
  max,
  min,
  disabledDates = [],
  ariaInvalid,
  ariaDescribedBy,
  className,
  placeholder = "Select date",
}: Readonly<DatePickerProps>) {
  const [open, setOpen] = useState(false);
  // Default the view to the max/min bound (e.g. 18-years-ago for DOB) instead of "today" so it doesn't open on a fully-disabled month.
  const fallback = value || max || min;
  const initial = fallback ? parseISO(fallback) : { year: new Date().getFullYear(), month: new Date().getMonth() };
  const [viewYear, setViewYear] = useState(initial.year);
  const [viewMonth, setViewMonth] = useState(initial.month);
  const [position, setPosition] = useState<{ top: number; left: number; width: number; openUp: boolean } | null>(
    null,
  );
  const containerRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const disabledSet = new Set(disabledDates);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        popoverRef.current &&
        !popoverRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (!open || !containerRef.current) return;
    function updatePosition() {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const popoverHeight = 320;
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp = spaceBelow < popoverHeight && rect.top > spaceBelow;
      setPosition({
        top: openUp ? rect.top : rect.bottom,
        left: rect.left,
        width: rect.width,
        openUp,
      });
    }
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open]);

  function openPicker() {
    const fallbackValue = value || max || min;
    if (fallbackValue) {
      const { year, month } = parseISO(fallbackValue);
      setViewYear(year);
      setViewMonth(month);
    }
    setOpen((current) => !current);
  }

  function isDisabled(dateStr: string): boolean {
    if (max && dateStr > max) return true;
    if (min && dateStr < min) return true;
    return disabledSet.has(dateStr);
  }

  function selectDate(dateStr: string) {
    if (isDisabled(dateStr)) return;
    onChange(dateStr);
    setOpen(false);
  }

  function goToPrevMonth() {
    setViewMonth((current) => {
      if (current === 0) {
        setViewYear((year) => year - 1);
        return 11;
      }
      return current - 1;
    });
  }

  function goToNextMonth() {
    setViewMonth((current) => {
      if (current === 11) {
        setViewYear((year) => year + 1);
        return 0;
      }
      return current + 1;
    });
  }

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const totalDays = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: totalDays }, (_, index) => index + 1),
  ];
  const monthLabel = new Intl.DateTimeFormat("en-IN", { month: "long" }).format(new Date(viewYear, viewMonth, 1));
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 120 }, (_, index) => currentYear - index);
  const displayValue = value
    ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(
        new Date(`${value}T00:00:00`),
      )
    : "";

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        id={id}
        onClick={openPicker}
        data-invalid={ariaInvalid ? "true" : undefined}
        aria-describedby={ariaDescribedBy}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`flex items-center justify-between gap-2 ${className ?? ""}`}
      >
        <span>{displayValue || <span className="text-gray-400">{placeholder}</span>}</span>
        <FontAwesomeIcon icon={faCalendarDay} className="h-3.5 w-3.5 shrink-0 text-brand-orange" />
      </button>
      {open &&
        position &&
        createPortal(
          <div
            ref={popoverRef}
            style={{
              position: "fixed",
              top: position.openUp ? undefined : position.top + 4,
              bottom: position.openUp ? window.innerHeight - position.top + 4 : undefined,
              left: position.left,
              minWidth: Math.max(position.width, 288),
            }}
            className="z-50 w-72 rounded-xl border border-brand-beige bg-white p-3 shadow-[0_20px_45px_rgba(36,50,58,0.25)]"
          >
            <div className="mb-2 flex items-center justify-between gap-1">
              <button
                type="button"
                onClick={goToPrevMonth}
                aria-label="Previous month"
                className="rounded-md px-2 py-1 text-sm text-gray-600 hover:bg-brand-sand"
              >
                ‹
              </button>
              <div className="flex items-center gap-1">
                <span className="text-sm font-semibold text-gray-900">{monthLabel}</span>
                <select
                  value={viewYear}
                  onChange={(event) => setViewYear(Number(event.target.value))}
                  aria-label="Select year"
                  className="rounded-md border border-brand-beige bg-white px-1 py-0.5 text-sm font-semibold text-gray-900 focus:outline-none"
                >
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={goToNextMonth}
                aria-label="Next month"
                className="rounded-md px-2 py-1 text-sm text-gray-600 hover:bg-brand-sand"
              >
                ›
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium uppercase text-gray-400">
              {WEEKDAYS.map((weekday) => (
                <div key={weekday}>{weekday}</div>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1">
              {cells.map((day, index) => {
                if (!day) return <div key={`blank-${index}`} />;
                const dateStr = toISO(viewYear, viewMonth, day);
                const disabled = isDisabled(dateStr);
                const selected = dateStr === value;
                return (
                  <button
                    key={dateStr}
                    type="button"
                    disabled={disabled}
                    onClick={() => selectDate(dateStr)}
                    title={disabled ? "A sale already exists for this date" : undefined}
                    className={`h-8 text-xs font-medium transition ${
                      selected
                        ? "bg-brand-orange text-white"
                        : disabled
                          ? "cursor-not-allowed text-gray-300 line-through"
                          : "text-gray-700 hover:bg-brand-peach"
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

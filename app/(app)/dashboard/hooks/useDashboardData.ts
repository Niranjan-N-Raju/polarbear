"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/app/hooks/useToast";
import { useStoreModal } from "@/app/(app)/store-context";
import { currentMonthRange, localDateValue } from "@/lib/date-utils";
import type { DailySale } from "@/types/sales";
import type { DashboardStats } from "@/types/dashboard";
import { dashboardRequest } from "../apicall/dashboard";

function todayRange(): { from: string; to: string } {
  const today = localDateValue();
  return { from: today, to: today };
}

function thisWeekRange(): { from: string; to: string } {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay());
  return { from: localDateValue(start), to: localDateValue() };
}

export function useDashboardData() {
  const { activeStoreId } = useStoreModal();
  const { error } = useToast();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [dailySales, setDailySales] = useState<DailySale[]>([]);
  const [dateFrom, setDateFrom] = useState(() => currentMonthRange().from);
  const [dateTo, setDateTo] = useState(() => currentMonthRange().to);

  useEffect(() => {
    dashboardRequest("/api/dashboard")
      .then((response) => response.json())
      .then((data: DashboardStats & { message?: string }) => {
        if ("message" in data) {
          setHasError(true);
          error(data.message ?? "Failed to load stats.");
        } else {
          setHasError(false);
          setStats(data);
        }
      })
      .catch(() => {
        setHasError(true);
        error("Failed to load stats.");
      })
      .finally(() => setLoading(false));
  }, [error]);

  useEffect(() => {
    let cancelled = false;
    if (!activeStoreId || dateFrom > dateTo) {
      queueMicrotask(() => {
        if (!cancelled) setDailySales([]);
      });
      return () => { cancelled = true; };
    }
    dashboardRequest(`/api/sales?franchiseId=${encodeURIComponent(activeStoreId)}&from=${dateFrom}&to=${dateTo}`)
      .then((response) => response.json())
      .then((data: { sales?: DailySale[] }) => { if (!cancelled) setDailySales(data.sales ?? []); })
      .catch(() => { if (!cancelled) setDailySales([]); });
    return () => { cancelled = true; };
  }, [activeStoreId, dateFrom, dateTo]);

  return {
    activeStoreId,
    stats,
    loading,
    hasError,
    dailySales,
    dateFrom,
    dateTo,
    setDateFrom,
    setDateTo,
    isFranchiseAdmin: stats !== null && "employeeSummary" in stats,
    resetToToday: () => {
      const range = todayRange();
      setDateFrom(range.from);
      setDateTo(range.to);
    },
    resetToThisWeek: () => {
      const range = thisWeekRange();
      setDateFrom(range.from);
      setDateTo(range.to);
    },
    resetToCurrentMonth: () => {
      const range = currentMonthRange();
      setDateFrom(range.from);
      setDateTo(range.to);
    },
  };
}

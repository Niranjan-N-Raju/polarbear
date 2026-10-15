"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { faIndianRupeeSign, faCircleCheck, faChartLine, faGift, faPen, faTrash, faDownload } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useStoreModal } from "@/app/(app)/store-context";
import { useToast } from "@/app/hooks/useToast";
import { SummaryCard } from "@/app/components/SummaryCard";
import { MobileSummaryDrawer } from "@/app/components/MobileSummaryDrawer";
import { MonthPicker } from "@/app/components/MonthPicker";
import type {
  AdvanceEntry,
  ExtraDayEntry,
  IncentiveEntry,
  SalaryData,
} from "@/types/salary";
import type { SalarySlipData } from "@/types/salary-slip";
import { salaryRequest } from "../apicall/salary";
import SalaryEntryPopover from "./SalaryEntryPopover";
import { generateSalarySlipPdf } from "../slip/pdf";
import {
  ADVANCE_TYPE_OPTIONS,
  EXTRA_DAY_TYPE_OPTIONS,
  INCENTIVE_TYPE_OPTIONS,
  currentPeriod,
  formatCurrency,
  formatDate,
  formatDays,
} from "../utils";

export default function SalaryPage() {
  const { activeStoreId } = useStoreModal();
  useEffect(() => { document.title = "Salary · Polar Bear"; }, []);
  const { error, success } = useToast();
  const [period, setPeriod] = useState(currentPeriod());
  const [data, setData] = useState<SalaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloadingSlipFor, setDownloadingSlipFor] = useState<string | null>(null);
  const [openIncentiveFor, setOpenIncentiveFor] = useState<string | null>(null);
  const [popoverAnchor, setPopoverAnchor] = useState<{ top: number; left: number } | null>(null);
  const [draftType, setDraftType] = useState<string>(INCENTIVE_TYPE_OPTIONS[0]);
  const [draftCustomType, setDraftCustomType] = useState("");
  const [draftAmount, setDraftAmount] = useState("");
  const [draftError, setDraftError] = useState<string | undefined>();
  const [savingIncentive, setSavingIncentive] = useState(false);
  const [detailsFor, setDetailsFor] = useState<string | null>(null);
  const [detailsAnchor, setDetailsAnchor] = useState<{ top: number; left: number } | null>(null);
  const [editingIncentiveId, setEditingIncentiveId] = useState<string | null>(null);
  const [editType, setEditType] = useState<string>(INCENTIVE_TYPE_OPTIONS[0]);
  const [editCustomType, setEditCustomType] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editError, setEditError] = useState<string | undefined>();
  const [savingEdit, setSavingEdit] = useState(false);
  const hideDetailsTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [openExtraDayFor, setOpenExtraDayFor] = useState<string | null>(null);
  const [extraDayPopoverAnchor, setExtraDayPopoverAnchor] = useState<{ top: number; left: number } | null>(null);
  const [extraDayDraftType, setExtraDayDraftType] = useState<string>(EXTRA_DAY_TYPE_OPTIONS[0]);
  const [extraDayDraftCustomType, setExtraDayDraftCustomType] = useState("");
  const [extraDayDraftAmount, setExtraDayDraftAmount] = useState("");
  const [extraDayDraftError, setExtraDayDraftError] = useState<string | undefined>();
  const [savingExtraDay, setSavingExtraDay] = useState(false);
  const [extraDayDetailsFor, setExtraDayDetailsFor] = useState<string | null>(null);
  const [extraDayDetailsAnchor, setExtraDayDetailsAnchor] = useState<{ top: number; left: number } | null>(null);
  const [editingExtraDayId, setEditingExtraDayId] = useState<string | null>(null);
  const [extraDayEditType, setExtraDayEditType] = useState<string>(EXTRA_DAY_TYPE_OPTIONS[0]);
  const [extraDayEditCustomType, setExtraDayEditCustomType] = useState("");
  const [extraDayEditAmount, setExtraDayEditAmount] = useState("");
  const [extraDayEditError, setExtraDayEditError] = useState<string | undefined>();
  const [savingExtraDayEdit, setSavingExtraDayEdit] = useState(false);
  const hideExtraDayDetailsTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [openAdvanceFor, setOpenAdvanceFor] = useState<string | null>(null);
  const [advancePopoverAnchor, setAdvancePopoverAnchor] = useState<{ top: number; left: number } | null>(null);
  const [advanceDraftType, setAdvanceDraftType] = useState<string>(ADVANCE_TYPE_OPTIONS[0]);
  const [advanceDraftCustomType, setAdvanceDraftCustomType] = useState("");
  const [advanceDraftAmount, setAdvanceDraftAmount] = useState("");
  const [advanceDraftError, setAdvanceDraftError] = useState<string | undefined>();
  const [savingAdvance, setSavingAdvance] = useState(false);
  const [advanceDetailsFor, setAdvanceDetailsFor] = useState<string | null>(null);
  const [advanceDetailsAnchor, setAdvanceDetailsAnchor] = useState<{ top: number; left: number } | null>(null);
  const [editingAdvanceId, setEditingAdvanceId] = useState<string | null>(null);
  const [advanceEditType, setAdvanceEditType] = useState<string>(ADVANCE_TYPE_OPTIONS[0]);
  const [advanceEditCustomType, setAdvanceEditCustomType] = useState("");
  const [advanceEditAmount, setAdvanceEditAmount] = useState("");
  const [advanceEditError, setAdvanceEditError] = useState<string | undefined>();
  const [savingAdvanceEdit, setSavingAdvanceEdit] = useState(false);
  const hideAdvanceDetailsTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadSalary = useCallback(async () => {
    if (!activeStoreId) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await salaryRequest(
        `/api/salary?franchiseId=${encodeURIComponent(activeStoreId)}&period=${encodeURIComponent(period)}`,
      );
      const result = (await response.json()) as SalaryData & { message?: string };
      if (!response.ok) throw new Error(result.message ?? "Failed to load salary projections.");
      setData(result);
    } catch (loadError) {
      error(loadError instanceof Error ? loadError.message : "Failed to load salary projections.");
    } finally {
      setLoading(false);
    }
  }, [activeStoreId, error, period]);

  useEffect(() => {
    queueMicrotask(() => void loadSalary());
  }, [loadSalary]);

  async function downloadSlip(employeeId: string, employeeName: string) {
    if (!activeStoreId) return;
    setDownloadingSlipFor(employeeId);
    try {
      const response = await salaryRequest(
        `/api/salary/slip?franchiseId=${encodeURIComponent(activeStoreId)}&employeeId=${encodeURIComponent(employeeId)}&period=${encodeURIComponent(period)}`,
      );
      const result = (await response.json()) as SalarySlipData & { message?: string };
      if (!response.ok) throw new Error(result.message ?? "Failed to download salary slip.");
      await generateSalarySlipPdf(result);
    } catch (downloadError) {
      error(downloadError instanceof Error ? downloadError.message : `Failed to download ${employeeName}'s salary slip.`);
    } finally {
      setDownloadingSlipFor(null);
    }
  }

  const totalBase = data?.projections.reduce((sum, item) => sum + item.salary, 0) ?? 0;
  const totalEarned = data?.projections.reduce((sum, item) => sum + item.earnedSalary, 0) ?? 0;
  const totalProjected =
    data?.projections.reduce((sum, item) => sum + item.projectedSalary, 0) ?? 0;
  const totalIncentives = data?.projections.reduce((sum, item) => sum + item.incentiveTotal, 0) ?? 0;
  function openIncentivePopover(employeeId: string, anchorEl: HTMLButtonElement) {
    const rect = anchorEl.getBoundingClientRect();
    setPopoverAnchor({ top: rect.top, left: rect.left });
    setOpenIncentiveFor(employeeId);
    setDraftType(INCENTIVE_TYPE_OPTIONS[0]);
    setDraftCustomType("");
    setDraftAmount("");
    setDraftError(undefined);
  }

  function toggleIncentivePopover(employeeId: string, anchorEl: HTMLButtonElement) {
    if (openIncentiveFor === employeeId) {
      setOpenIncentiveFor(null);
      setPopoverAnchor(null);
      return;
    }
    openIncentivePopover(employeeId, anchorEl);
  }

  function closeIncentivePopover() {
    setOpenIncentiveFor(null);
    setPopoverAnchor(null);
  }

  function cancelHideDetails() {
    if (hideDetailsTimeout.current) {
      clearTimeout(hideDetailsTimeout.current);
      hideDetailsTimeout.current = null;
    }
  }

  function showDetails(employeeId: string, anchorEl: HTMLElement) {
    cancelHideDetails();
    const rect = anchorEl.getBoundingClientRect();
    setDetailsAnchor({ top: rect.top, left: rect.left });
    setDetailsFor(employeeId);
  }

  function scheduleHideDetails() {
    cancelHideDetails();
    hideDetailsTimeout.current = setTimeout(() => {
      setDetailsFor(null);
      setDetailsAnchor(null);
      setEditingIncentiveId(null);
    }, 150);
  }

  function startEditIncentive(incentive: IncentiveEntry) {
    setEditingIncentiveId(incentive.id);
    const isPredefined = (INCENTIVE_TYPE_OPTIONS as readonly string[]).includes(incentive.type);
    setEditType(isPredefined ? incentive.type : "Other");
    setEditCustomType(isPredefined ? "" : incentive.type);
    setEditAmount(String(incentive.amount));
    setEditError(undefined);
  }

  function cancelEditIncentive() {
    setEditingIncentiveId(null);
    setEditError(undefined);
  }

  async function saveEditIncentive(incentiveId: string) {
    const type = editType === "Other" ? editCustomType.trim() : editType;
    const amount = Number.parseFloat(editAmount);
    if (!type || !editAmount.trim() || Number.isNaN(amount) || amount < 0) {
      setEditError("Enter a type and a valid amount.");
      return;
    }
    setSavingEdit(true);
    try {
      const response = await salaryRequest(`/api/incentives/${incentiveId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, amount }),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message ?? "Failed to update incentive.");
      setEditingIncentiveId(null);
      success(result.message ?? "Incentive updated.");
      await loadSalary();
    } catch (editErr) {
      setEditError(editErr instanceof Error ? editErr.message : "Failed to update incentive.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function addIncentive(employeeId: string) {
    const type = draftType === "Other" ? draftCustomType.trim() : draftType;
    const amount = Number.parseFloat(draftAmount);
    if (!type || !draftAmount.trim() || Number.isNaN(amount) || amount < 0) {
      setDraftError("Enter a type and a valid amount.");
      return;
    }
    if (!activeStoreId) return;
    setSavingIncentive(true);
    try {
      const response = await salaryRequest("/api/incentives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ franchiseId: activeStoreId, employeeId, period, type, amount }),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message ?? "Failed to add incentive.");
      closeIncentivePopover();
      success(result.message ?? "Incentive added successfully.");
      await loadSalary();
    } catch (addError) {
      setDraftError(addError instanceof Error ? addError.message : "Failed to add incentive.");
    } finally {
      setSavingIncentive(false);
    }
  }

  async function removeIncentive(incentiveId: string) {
    try {
      const response = await salaryRequest(`/api/incentives/${incentiveId}`, { method: "DELETE" });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message ?? "Failed to remove incentive.");
      success(result.message ?? "Incentive removed.");
      await loadSalary();
    } catch (removeError) {
      error(removeError instanceof Error ? removeError.message : "Failed to remove incentive.");
    }
  }

  function openExtraDayPopover(employeeId: string, anchorEl: HTMLButtonElement) {
    const rect = anchorEl.getBoundingClientRect();
    setExtraDayPopoverAnchor({ top: rect.top, left: rect.left });
    setOpenExtraDayFor(employeeId);
    setExtraDayDraftType(EXTRA_DAY_TYPE_OPTIONS[0]);
    setExtraDayDraftCustomType("");
    setExtraDayDraftAmount("");
    setExtraDayDraftError(undefined);
  }

  function toggleExtraDayPopover(employeeId: string, anchorEl: HTMLButtonElement) {
    if (openExtraDayFor === employeeId) {
      setOpenExtraDayFor(null);
      setExtraDayPopoverAnchor(null);
      return;
    }
    openExtraDayPopover(employeeId, anchorEl);
  }

  function closeExtraDayPopover() {
    setOpenExtraDayFor(null);
    setExtraDayPopoverAnchor(null);
  }

  function cancelHideExtraDayDetails() {
    if (hideExtraDayDetailsTimeout.current) {
      clearTimeout(hideExtraDayDetailsTimeout.current);
      hideExtraDayDetailsTimeout.current = null;
    }
  }

  function showExtraDayDetails(employeeId: string, anchorEl: HTMLElement) {
    cancelHideExtraDayDetails();
    const rect = anchorEl.getBoundingClientRect();
    setExtraDayDetailsAnchor({ top: rect.top, left: rect.left });
    setExtraDayDetailsFor(employeeId);
  }

  function scheduleHideExtraDayDetails() {
    cancelHideExtraDayDetails();
    hideExtraDayDetailsTimeout.current = setTimeout(() => {
      setExtraDayDetailsFor(null);
      setExtraDayDetailsAnchor(null);
      setEditingExtraDayId(null);
    }, 150);
  }

  function startEditExtraDay(extraDay: ExtraDayEntry) {
    setEditingExtraDayId(extraDay.id);
    const isPredefined = (EXTRA_DAY_TYPE_OPTIONS as readonly string[]).includes(extraDay.type);
    setExtraDayEditType(isPredefined ? extraDay.type : "Other");
    setExtraDayEditCustomType(isPredefined ? "" : extraDay.type);
    setExtraDayEditAmount(String(extraDay.days));
    setExtraDayEditError(undefined);
  }

  function cancelEditExtraDay() {
    setEditingExtraDayId(null);
    setExtraDayEditError(undefined);
  }

  async function saveEditExtraDay(extraDayId: string) {
    const type = extraDayEditType === "Other" ? extraDayEditCustomType.trim() : extraDayEditType;
    const days = Number.parseFloat(extraDayEditAmount);
    if (!type || !extraDayEditAmount.trim() || Number.isNaN(days) || days < 0) {
      setExtraDayEditError("Enter a reason and a valid number of days.");
      return;
    }
    setSavingExtraDayEdit(true);
    try {
      const response = await salaryRequest(`/api/extra-days/${extraDayId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, days }),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message ?? "Failed to update extra days.");
      setEditingExtraDayId(null);
      success(result.message ?? "Extra days updated.");
      await loadSalary();
    } catch (editErr) {
      setExtraDayEditError(editErr instanceof Error ? editErr.message : "Failed to update extra days.");
    } finally {
      setSavingExtraDayEdit(false);
    }
  }

  async function addExtraDay(employeeId: string) {
    const type = extraDayDraftType === "Other" ? extraDayDraftCustomType.trim() : extraDayDraftType;
    const days = Number.parseFloat(extraDayDraftAmount);
    if (!type || !extraDayDraftAmount.trim() || Number.isNaN(days) || days < 0) {
      setExtraDayDraftError("Enter a reason and a valid number of days.");
      return;
    }
    if (!activeStoreId) return;
    setSavingExtraDay(true);
    try {
      const response = await salaryRequest("/api/extra-days", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ franchiseId: activeStoreId, employeeId, period, type, days }),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message ?? "Failed to add extra days.");
      closeExtraDayPopover();
      success(result.message ?? "Extra days added successfully.");
      await loadSalary();
    } catch (addError) {
      setExtraDayDraftError(addError instanceof Error ? addError.message : "Failed to add extra days.");
    } finally {
      setSavingExtraDay(false);
    }
  }

  async function removeExtraDay(extraDayId: string) {
    try {
      const response = await salaryRequest(`/api/extra-days/${extraDayId}`, { method: "DELETE" });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message ?? "Failed to remove extra days.");
      success(result.message ?? "Extra days removed.");
      await loadSalary();
    } catch (removeError) {
      error(removeError instanceof Error ? removeError.message : "Failed to remove extra days.");
    }
  }

  function openAdvancePopover(employeeId: string, anchorEl: HTMLButtonElement) {
    const rect = anchorEl.getBoundingClientRect();
    setAdvancePopoverAnchor({ top: rect.top, left: rect.left });
    setOpenAdvanceFor(employeeId);
    setAdvanceDraftType(ADVANCE_TYPE_OPTIONS[0]);
    setAdvanceDraftCustomType("");
    setAdvanceDraftAmount("");
    setAdvanceDraftError(undefined);
  }

  function toggleAdvancePopover(employeeId: string, anchorEl: HTMLButtonElement) {
    if (openAdvanceFor === employeeId) {
      setOpenAdvanceFor(null);
      setAdvancePopoverAnchor(null);
      return;
    }
    openAdvancePopover(employeeId, anchorEl);
  }

  function closeAdvancePopover() {
    setOpenAdvanceFor(null);
    setAdvancePopoverAnchor(null);
  }

  function cancelHideAdvanceDetails() {
    if (hideAdvanceDetailsTimeout.current) {
      clearTimeout(hideAdvanceDetailsTimeout.current);
      hideAdvanceDetailsTimeout.current = null;
    }
  }

  function showAdvanceDetails(employeeId: string, anchorEl: HTMLElement) {
    cancelHideAdvanceDetails();
    const rect = anchorEl.getBoundingClientRect();
    setAdvanceDetailsAnchor({ top: rect.top, left: rect.left });
    setAdvanceDetailsFor(employeeId);
  }

  function scheduleHideAdvanceDetails() {
    cancelHideAdvanceDetails();
    hideAdvanceDetailsTimeout.current = setTimeout(() => {
      setAdvanceDetailsFor(null);
      setAdvanceDetailsAnchor(null);
      setEditingAdvanceId(null);
    }, 150);
  }

  function startEditAdvance(advance: AdvanceEntry) {
    setEditingAdvanceId(advance.id);
    const isPredefined = (ADVANCE_TYPE_OPTIONS as readonly string[]).includes(advance.type);
    setAdvanceEditType(isPredefined ? advance.type : "Other");
    setAdvanceEditCustomType(isPredefined ? "" : advance.type);
    setAdvanceEditAmount(String(advance.amount));
    setAdvanceEditError(undefined);
  }

  function cancelEditAdvance() {
    setEditingAdvanceId(null);
    setAdvanceEditError(undefined);
  }

  async function saveEditAdvance(advanceId: string) {
    const type = advanceEditType === "Other" ? advanceEditCustomType.trim() : advanceEditType;
    const amount = Number.parseFloat(advanceEditAmount);
    if (!type || !advanceEditAmount.trim() || Number.isNaN(amount) || amount < 0) {
      setAdvanceEditError("Enter a reason and a valid amount.");
      return;
    }
    setSavingAdvanceEdit(true);
    try {
      const response = await salaryRequest(`/api/advances/${advanceId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, amount }),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message ?? "Failed to update advance.");
      setEditingAdvanceId(null);
      success(result.message ?? "Advance updated.");
      await loadSalary();
    } catch (editErr) {
      setAdvanceEditError(editErr instanceof Error ? editErr.message : "Failed to update advance.");
    } finally {
      setSavingAdvanceEdit(false);
    }
  }

  async function addAdvance(employeeId: string) {
    const type = advanceDraftType === "Other" ? advanceDraftCustomType.trim() : advanceDraftType;
    const amount = Number.parseFloat(advanceDraftAmount);
    if (!type || !advanceDraftAmount.trim() || Number.isNaN(amount) || amount < 0) {
      setAdvanceDraftError("Enter a reason and a valid amount.");
      return;
    }
    if (!activeStoreId) return;
    setSavingAdvance(true);
    try {
      const response = await salaryRequest("/api/advances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ franchiseId: activeStoreId, employeeId, period, type, amount }),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message ?? "Failed to add advance.");
      closeAdvancePopover();
      success(result.message ?? "Advance added successfully.");
      await loadSalary();
    } catch (addError) {
      setAdvanceDraftError(addError instanceof Error ? addError.message : "Failed to add advance.");
    } finally {
      setSavingAdvance(false);
    }
  }

  async function removeAdvance(advanceId: string) {
    try {
      const response = await salaryRequest(`/api/advances/${advanceId}`, { method: "DELETE" });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message ?? "Failed to remove advance.");
      success(result.message ?? "Advance removed.");
      await loadSalary();
    } catch (removeError) {
      error(removeError instanceof Error ? removeError.message : "Failed to remove advance.");
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-brand-beige bg-white/80 p-6 shadow-[0_10px_30px_rgba(36,50,58,0.05)]">
        <div>
          <p className="hidden text-xs font-semibold uppercase tracking-[0.18em] text-brand-orange sm:block">Payroll overview</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-gray-900">Salary Projections</h2>
          <p className="mt-2 text-sm text-gray-500">
            {data?.store.name ?? "Select a store to view salary projections"}
          </p>
        </div>
        <label className="block w-56 max-w-full">
          <span className="mb-1 block text-xs font-medium text-gray-500">Period ending month</span>
          <MonthPicker value={period} onChange={setPeriod} />
        </label>
      </div>

      {!activeStoreId ? (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-500">
          Select a store to view salary projections.
        </div>
      ) : loading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-orange border-t-transparent" />
        </div>
      ) : data ? (
        <>
          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="font-semibold text-gray-900">Salary Cycle</h3>
            {data.cycle.configured ? (
              <p className="mt-1 text-sm text-gray-500">
                {formatDate(data.cycle.from)} to {formatDate(data.cycle.to)} · {data.cycle.totalDays} days
              </p>
            ) : (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-gray-500">Configure the salary cycle before viewing projections.</p>
                <Link href="/store-config" className="rounded-lg bg-brand-orange px-4 py-2 text-sm font-medium text-white hover:bg-brand-orange/90">
                  Open Store Config
                </Link>
              </div>
            )}
          </section>

          {data.cycle.configured && (
          <>
          <div className="hidden gap-3 sm:grid sm:grid-cols-4 sm:gap-4">
            {[
              { label: "Monthly payroll", value: totalBase, color: "teal" as const, icon: faIndianRupeeSign },
              { label: "Earned to date", value: totalEarned, color: "orange" as const, icon: faCircleCheck },
              { label: "Total incentives", value: totalIncentives, color: "orange" as const, icon: faGift },
              { label: "Projected payroll", value: totalProjected, color: "teal" as const, icon: faChartLine },
            ].map((item) => (
              <SummaryCard
                key={item.label}
                label={item.label}
                value={formatCurrency(item.value)}
                color={item.color}
                icon={item.icon}
              />
            ))}
          </div>
          <MobileSummaryDrawer
            cards={[
              { label: "Monthly payroll", value: formatCurrency(totalBase), color: "teal" as const, icon: faIndianRupeeSign },
              { label: "Earned to date", value: formatCurrency(totalEarned), color: "orange" as const, icon: faCircleCheck },
              { label: "Total incentives", value: formatCurrency(totalIncentives), color: "orange" as const, icon: faGift },
              { label: "Projected payroll", value: formatCurrency(totalProjected), color: "teal" as const, icon: faChartLine },
            ]}
          />

          <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            {data.projections.length === 0 ? (
              <p className="px-6 py-14 text-center text-sm text-gray-500">No active employees found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-brand-sand/50 border-b border-brand-beige">
                      <th className="text-left px-5 py-3 font-semibold text-gray-600">Employee</th>
                      <th className="text-left px-5 py-3 font-semibold text-gray-600">Paid days</th>
                      <th className="text-left px-5 py-3 font-semibold text-gray-600">Absent</th>
                      <th className="text-left px-5 py-3 font-semibold text-gray-600">Week Offs</th>
                      <th className="text-left px-5 py-3 font-semibold text-gray-600">Extra Days</th>
                      <th className="text-left px-5 py-3 font-semibold text-gray-600">Incentives</th>
                      <th className="text-left px-5 py-3 font-semibold text-gray-600">Advances</th>
                      <th className="text-left px-5 py-3 font-semibold text-gray-600">Earned/Projected</th>
                      <th className="text-right px-5 py-3 font-semibold text-gray-600">Slip</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-beige/60">
                    {data.projections.map((projection) => (
                      <tr key={projection.employeeId} className="hover:bg-brand-sand/20 transition">
                        <td className="px-5 py-3.5">
                          <p className="font-medium text-gray-900">{projection.name}</p>
                          <p className="mt-0.5 text-xs text-gray-500">
                            {[projection.position, projection.employmentType === "part_time" ? "Part Time" : "Full Time"]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </td>
                        <td className="px-5 py-3.5 text-brand-teal">{projection.paidDays}</td>
                        <td className="px-5 py-3.5 text-red-600">{projection.absentDays}</td>
                        <td className="px-5 py-3.5 text-brand-orange">{projection.weekOffDays}</td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <span
                              className="whitespace-nowrap text-gray-600 underline decoration-dotted decoration-gray-300 underline-offset-4 cursor-default"
                              onMouseEnter={(event) => {
                                if (projection.extraDays.length > 0) showExtraDayDetails(projection.employeeId, event.currentTarget);
                              }}
                              onMouseLeave={scheduleHideExtraDayDetails}
                            >
                              {formatDays(projection.extraDaysTotal)}
                            </span>
                            <button
                              type="button"
                              onClick={(event) => toggleExtraDayPopover(projection.employeeId, event.currentTarget)}
                              className="shrink-0 whitespace-nowrap text-xs font-medium text-brand-orange hover:text-brand-orange/80 transition"
                            >
                              + Add
                            </button>
                            {extraDayDetailsFor === projection.employeeId &&
                              extraDayDetailsAnchor &&
                              projection.extraDays.length > 0 &&
                              createPortal(
                                <div
                                  className="fixed z-[9999] w-72 -translate-y-full rounded-xl border border-brand-beige bg-white p-3 shadow-[0_20px_45px_rgba(36,50,58,0.25)] text-left"
                                  style={{ top: extraDayDetailsAnchor.top - 8, left: extraDayDetailsAnchor.left }}
                                  onMouseEnter={cancelHideExtraDayDetails}
                                  onMouseLeave={scheduleHideExtraDayDetails}
                                >
                                  <ul className="space-y-1.5">
                                    {projection.extraDays.map((extraDay) =>
                                      editingExtraDayId === extraDay.id ? (
                                        <li key={extraDay.id} className="rounded-lg bg-brand-sand/40 p-2 space-y-1.5">
                                          <select
                                            value={extraDayEditType}
                                            onChange={(event) => { setExtraDayEditType(event.target.value); setExtraDayEditError(undefined); }}
                                            className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-brand-orange focus:border-brand-orange"
                                          >
                                            {EXTRA_DAY_TYPE_OPTIONS.map((option) => (
                                              <option key={option} value={option}>{option}</option>
                                            ))}
                                          </select>
                                          {extraDayEditType === "Other" && (
                                            <input
                                              type="text"
                                              value={extraDayEditCustomType}
                                              onChange={(event) => { setExtraDayEditCustomType(event.target.value); setExtraDayEditError(undefined); }}
                                              placeholder="Enter reason"
                                              className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-orange focus:border-brand-orange"
                                            />
                                          )}
                                          <input
                                            type="text"
                                            inputMode="decimal"
                                            value={extraDayEditAmount}
                                            onChange={(event) => { setExtraDayEditAmount(event.target.value.replaceAll(/[^\d.]/g, "")); setExtraDayEditError(undefined); }}
                                            placeholder="0"
                                            className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-orange focus:border-brand-orange"
                                          />
                                          {extraDayEditError && (
                                            <p className="text-xs text-red-600" role="alert">{extraDayEditError}</p>
                                          )}
                                          <div className="flex items-center gap-2">
                                            <button
                                              type="button"
                                              onClick={() => void saveEditExtraDay(extraDay.id)}
                                              disabled={savingExtraDayEdit}
                                              className="flex-1 bg-brand-orange text-white text-xs font-medium px-2 py-1.5 rounded-md hover:bg-brand-orange/90 transition disabled:cursor-not-allowed disabled:opacity-60"
                                            >
                                              {savingExtraDayEdit ? "Saving…" : "Save"}
                                            </button>
                                            <button
                                              type="button"
                                              onClick={cancelEditExtraDay}
                                              className="flex-1 text-xs font-medium text-gray-500 hover:text-gray-700 transition"
                                            >
                                              Cancel
                                            </button>
                                          </div>
                                        </li>
                                      ) : (
                                        <li
                                          key={extraDay.id}
                                          className="flex items-center justify-between gap-2 rounded-lg bg-brand-sand/40 px-2.5 py-1.5 text-xs"
                                        >
                                          <span className="truncate">
                                            {extraDay.type}: {formatDays(extraDay.days)}
                                          </span>
                                          <span className="flex shrink-0 items-center gap-2">
                                            <button
                                              type="button"
                                              onClick={() => startEditExtraDay(extraDay)}
                                              aria-label={`Edit ${extraDay.type}`}
                                              className="text-gray-400 hover:text-brand-orange transition"
                                            >
                                              <FontAwesomeIcon icon={faPen} className="h-3 w-3" />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => void removeExtraDay(extraDay.id)}
                                              aria-label={`Remove ${extraDay.type}`}
                                              className="text-gray-400 hover:text-red-600 transition"
                                            >
                                              <FontAwesomeIcon icon={faTrash} className="h-3 w-3" />
                                            </button>
                                          </span>
                                        </li>
                                      ),
                                    )}
                                  </ul>
                                </div>,
                                document.body,
                              )}
                            {openExtraDayFor === projection.employeeId && extraDayPopoverAnchor && (
                              <SalaryEntryPopover
                                anchor={extraDayPopoverAnchor}
                                label="Reason"
                                options={EXTRA_DAY_TYPE_OPTIONS}
                                type={extraDayDraftType}
                                customType={extraDayDraftCustomType}
                                amount={extraDayDraftAmount}
                                amountLabel="Days"
                                error={extraDayDraftError}
                                saving={savingExtraDay}
                                onTypeChange={(value) => { setExtraDayDraftType(value); setExtraDayDraftError(undefined); }}
                                onCustomTypeChange={(value) => { setExtraDayDraftCustomType(value); setExtraDayDraftError(undefined); }}
                                onAmountChange={(value) => { setExtraDayDraftAmount(value); setExtraDayDraftError(undefined); }}
                                onClose={closeExtraDayPopover}
                                onSubmit={() => void addExtraDay(projection.employeeId)}
                              />
                            )}
                            {false && openExtraDayFor === projection.employeeId &&
                              extraDayPopoverAnchor &&
                              createPortal(
                                <>
                                  <button
                                    type="button"
                                    aria-label="Close extra days popover"
                                    className="fixed inset-0 z-[9998] cursor-default"
                                    onClick={closeExtraDayPopover}
                                  />
                                  <div
                                    className="fixed z-[9999] w-72 -translate-y-full rounded-xl border border-brand-beige bg-white p-4 shadow-[0_20px_45px_rgba(36,50,58,0.25)] text-left"
                                    style={{ top: extraDayPopoverAnchor!.top - 8, left: extraDayPopoverAnchor!.left }}
                                  >
                                    <div className="space-y-3">
                                      <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Reason</label>
                                        <select
                                          value={extraDayDraftType}
                                          onChange={(event) => { setExtraDayDraftType(event.target.value); setExtraDayDraftError(undefined); }}
                                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-brand-orange focus:border-brand-orange"
                                        >
                                          {EXTRA_DAY_TYPE_OPTIONS.map((option) => (
                                            <option key={option} value={option}>{option}</option>
                                          ))}
                                        </select>
                                        {extraDayDraftType === "Other" && (
                                          <input
                                            type="text"
                                            value={extraDayDraftCustomType}
                                            onChange={(event) => { setExtraDayDraftCustomType(event.target.value); setExtraDayDraftError(undefined); }}
                                            placeholder="Enter reason"
                                            className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-orange focus:border-brand-orange"
                                          />
                                        )}
                                      </div>
                                      <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Days</label>
                                        <input
                                          type="text"
                                          inputMode="decimal"
                                          value={extraDayDraftAmount}
                                          onChange={(event) => { setExtraDayDraftAmount(event.target.value.replaceAll(/[^\d.]/g, "")); setExtraDayDraftError(undefined); }}
                                          placeholder="0"
                                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-orange focus:border-brand-orange"
                                        />
                                      </div>
                                      {extraDayDraftError && (
                                        <p className="text-xs text-red-600" role="alert">{extraDayDraftError}</p>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => void addExtraDay(projection.employeeId)}
                                        disabled={savingExtraDay}
                                        className="w-full bg-brand-orange text-white text-sm font-medium px-3 py-2 rounded-lg hover:bg-brand-orange/90 transition disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        {savingExtraDay ? "Saving…" : "Add"}
                                      </button>
                                    </div>
                                  </div>
                                </>,
                                document.body,
                              )}
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <span
                              className="whitespace-nowrap text-gray-600 underline decoration-dotted decoration-gray-300 underline-offset-4 cursor-default"
                              onMouseEnter={(event) => {
                                if (projection.incentives.length > 0) showDetails(projection.employeeId, event.currentTarget);
                              }}
                              onMouseLeave={scheduleHideDetails}
                            >
                              {formatCurrency(projection.incentiveTotal)}
                            </span>
                            <button
                              type="button"
                              onClick={(event) => toggleIncentivePopover(projection.employeeId, event.currentTarget)}
                              className="shrink-0 whitespace-nowrap text-xs font-medium text-brand-orange hover:text-brand-orange/80 transition"
                            >
                              + Add
                            </button>
                            {detailsFor === projection.employeeId &&
                              detailsAnchor &&
                              projection.incentives.length > 0 &&
                              createPortal(
                                <div
                                  className="fixed z-[9999] w-72 -translate-y-full rounded-xl border border-brand-beige bg-white p-3 shadow-[0_20px_45px_rgba(36,50,58,0.25)] text-left"
                                  style={{ top: detailsAnchor.top - 8, left: detailsAnchor.left }}
                                  onMouseEnter={cancelHideDetails}
                                  onMouseLeave={scheduleHideDetails}
                                >
                                  <ul className="space-y-1.5">
                                    {projection.incentives.map((incentive) =>
                                      editingIncentiveId === incentive.id ? (
                                        <li key={incentive.id} className="rounded-lg bg-brand-sand/40 p-2 space-y-1.5">
                                          <select
                                            value={editType}
                                            onChange={(event) => { setEditType(event.target.value); setEditError(undefined); }}
                                            className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-brand-orange focus:border-brand-orange"
                                          >
                                            {INCENTIVE_TYPE_OPTIONS.map((option) => (
                                              <option key={option} value={option}>{option}</option>
                                            ))}
                                          </select>
                                          {editType === "Other" && (
                                            <input
                                              type="text"
                                              value={editCustomType}
                                              onChange={(event) => { setEditCustomType(event.target.value); setEditError(undefined); }}
                                              placeholder="Enter incentive type"
                                              className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-orange focus:border-brand-orange"
                                            />
                                          )}
                                          <input
                                            type="text"
                                            inputMode="decimal"
                                            value={editAmount}
                                            onChange={(event) => { setEditAmount(event.target.value.replaceAll(/[^\d.]/g, "")); setEditError(undefined); }}
                                            placeholder="0.00"
                                            className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-orange focus:border-brand-orange"
                                          />
                                          {editError && (
                                            <p className="text-xs text-red-600" role="alert">{editError}</p>
                                          )}
                                          <div className="flex items-center gap-2">
                                            <button
                                              type="button"
                                              onClick={() => void saveEditIncentive(incentive.id)}
                                              disabled={savingEdit}
                                              className="flex-1 bg-brand-orange text-white text-xs font-medium px-2 py-1.5 rounded-md hover:bg-brand-orange/90 transition disabled:cursor-not-allowed disabled:opacity-60"
                                            >
                                              {savingEdit ? "Saving…" : "Save"}
                                            </button>
                                            <button
                                              type="button"
                                              onClick={cancelEditIncentive}
                                              className="flex-1 text-xs font-medium text-gray-500 hover:text-gray-700 transition"
                                            >
                                              Cancel
                                            </button>
                                          </div>
                                        </li>
                                      ) : (
                                        <li
                                          key={incentive.id}
                                          className="flex items-center justify-between gap-2 rounded-lg bg-brand-sand/40 px-2.5 py-1.5 text-xs"
                                        >
                                          <span className="truncate">
                                            {incentive.type}: {formatCurrency(incentive.amount)}
                                          </span>
                                          <span className="flex shrink-0 items-center gap-2">
                                            <button
                                              type="button"
                                              onClick={() => startEditIncentive(incentive)}
                                              aria-label={`Edit ${incentive.type}`}
                                              className="text-gray-400 hover:text-brand-orange transition"
                                            >
                                              <FontAwesomeIcon icon={faPen} className="h-3 w-3" />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => void removeIncentive(incentive.id)}
                                              aria-label={`Remove ${incentive.type}`}
                                              className="text-gray-400 hover:text-red-600 transition"
                                            >
                                              <FontAwesomeIcon icon={faTrash} className="h-3 w-3" />
                                            </button>
                                          </span>
                                        </li>
                                      ),
                                    )}
                                  </ul>
                                </div>,
                                document.body,
                              )}
                            {openIncentiveFor === projection.employeeId && popoverAnchor && (
                              <SalaryEntryPopover
                                anchor={popoverAnchor}
                                label="Type"
                                options={INCENTIVE_TYPE_OPTIONS}
                                type={draftType}
                                customType={draftCustomType}
                                amount={draftAmount}
                                amountLabel="Amount"
                                error={draftError}
                                saving={savingIncentive}
                                onTypeChange={(value) => { setDraftType(value); setDraftError(undefined); }}
                                onCustomTypeChange={(value) => { setDraftCustomType(value); setDraftError(undefined); }}
                                onAmountChange={(value) => { setDraftAmount(value); setDraftError(undefined); }}
                                onClose={closeIncentivePopover}
                                onSubmit={() => void addIncentive(projection.employeeId)}
                              />
                            )}
                            {false && openIncentiveFor === projection.employeeId &&
                              popoverAnchor &&
                              createPortal(
                                <>
                                  <button
                                    type="button"
                                    aria-label="Close incentive popover"
                                    className="fixed inset-0 z-[9998] cursor-default"
                                    onClick={closeIncentivePopover}
                                  />
                                  <div
                                    className="fixed z-[9999] w-72 -translate-y-full rounded-xl border border-brand-beige bg-white p-4 shadow-[0_20px_45px_rgba(36,50,58,0.25)] text-left"
                                    style={{ top: popoverAnchor!.top - 8, left: popoverAnchor!.left }}
                                  >
                                    <div className="space-y-3">
                                      <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
                                        <select
                                          value={draftType}
                                          onChange={(event) => { setDraftType(event.target.value); setDraftError(undefined); }}
                                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-brand-orange focus:border-brand-orange"
                                        >
                                          {INCENTIVE_TYPE_OPTIONS.map((option) => (
                                            <option key={option} value={option}>{option}</option>
                                          ))}
                                        </select>
                                        {draftType === "Other" && (
                                          <input
                                            type="text"
                                            value={draftCustomType}
                                            onChange={(event) => { setDraftCustomType(event.target.value); setDraftError(undefined); }}
                                            placeholder="Enter incentive type"
                                            className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-orange focus:border-brand-orange"
                                          />
                                        )}
                                      </div>
                                      <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Amount</label>
                                        <input
                                          type="text"
                                          inputMode="decimal"
                                          value={draftAmount}
                                          onChange={(event) => { setDraftAmount(event.target.value.replaceAll(/[^\d.]/g, "")); setDraftError(undefined); }}
                                          placeholder="0.00"
                                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-orange focus:border-brand-orange"
                                        />
                                      </div>
                                      {draftError && (
                                        <p className="text-xs text-red-600" role="alert">{draftError}</p>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => void addIncentive(projection.employeeId)}
                                        disabled={savingIncentive}
                                        className="w-full bg-brand-orange text-white text-sm font-medium px-3 py-2 rounded-lg hover:bg-brand-orange/90 transition disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        {savingIncentive ? "Saving…" : "Add"}
                                      </button>
                                    </div>
                                  </div>
                                </>,
                                document.body,
                              )}
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <span
                              className="whitespace-nowrap text-gray-600 underline decoration-dotted decoration-gray-300 underline-offset-4 cursor-default"
                              onMouseEnter={(event) => {
                                if (projection.advances.length > 0) showAdvanceDetails(projection.employeeId, event.currentTarget);
                              }}
                              onMouseLeave={scheduleHideAdvanceDetails}
                            >
                              {formatCurrency(projection.advanceTotal)}
                            </span>
                            <button
                              type="button"
                              onClick={(event) => toggleAdvancePopover(projection.employeeId, event.currentTarget)}
                              className="shrink-0 whitespace-nowrap text-xs font-medium text-brand-orange hover:text-brand-orange/80 transition"
                            >
                              + Add
                            </button>
                            {advanceDetailsFor === projection.employeeId &&
                              advanceDetailsAnchor &&
                              projection.advances.length > 0 &&
                              createPortal(
                                <div
                                  className="fixed z-[9999] w-72 -translate-y-full rounded-xl border border-brand-beige bg-white p-3 shadow-[0_20px_45px_rgba(36,50,58,0.25)] text-left"
                                  style={{ top: advanceDetailsAnchor.top - 8, left: advanceDetailsAnchor.left }}
                                  onMouseEnter={cancelHideAdvanceDetails}
                                  onMouseLeave={scheduleHideAdvanceDetails}
                                >
                                  <ul className="space-y-1.5">
                                    {projection.advances.map((advance) =>
                                      editingAdvanceId === advance.id ? (
                                        <li key={advance.id} className="rounded-lg bg-brand-sand/40 p-2 space-y-1.5">
                                          <select
                                            value={advanceEditType}
                                            onChange={(event) => { setAdvanceEditType(event.target.value); setAdvanceEditError(undefined); }}
                                            className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-brand-orange focus:border-brand-orange"
                                          >
                                            {ADVANCE_TYPE_OPTIONS.map((option) => (
                                              <option key={option} value={option}>{option}</option>
                                            ))}
                                          </select>
                                          {advanceEditType === "Other" && (
                                            <input
                                              type="text"
                                              value={advanceEditCustomType}
                                              onChange={(event) => { setAdvanceEditCustomType(event.target.value); setAdvanceEditError(undefined); }}
                                              placeholder="Enter reason"
                                              className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-orange focus:border-brand-orange"
                                            />
                                          )}
                                          <input
                                            type="text"
                                            inputMode="decimal"
                                            value={advanceEditAmount}
                                            onChange={(event) => { setAdvanceEditAmount(event.target.value.replaceAll(/[^\d.]/g, "")); setAdvanceEditError(undefined); }}
                                            placeholder="0.00"
                                            className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-orange focus:border-brand-orange"
                                          />
                                          {advanceEditError && (
                                            <p className="text-xs text-red-600" role="alert">{advanceEditError}</p>
                                          )}
                                          <div className="flex items-center gap-2">
                                            <button
                                              type="button"
                                              onClick={() => void saveEditAdvance(advance.id)}
                                              disabled={savingAdvanceEdit}
                                              className="flex-1 bg-brand-orange text-white text-xs font-medium px-2 py-1.5 rounded-md hover:bg-brand-orange/90 transition disabled:cursor-not-allowed disabled:opacity-60"
                                            >
                                              {savingAdvanceEdit ? "Saving…" : "Save"}
                                            </button>
                                            <button
                                              type="button"
                                              onClick={cancelEditAdvance}
                                              className="flex-1 text-xs font-medium text-gray-500 hover:text-gray-700 transition"
                                            >
                                              Cancel
                                            </button>
                                          </div>
                                        </li>
                                      ) : (
                                        <li
                                          key={advance.id}
                                          className="flex items-center justify-between gap-2 rounded-lg bg-brand-sand/40 px-2.5 py-1.5 text-xs"
                                        >
                                          <span className="truncate">
                                            {advance.type}: {formatCurrency(advance.amount)}
                                          </span>
                                          <span className="flex shrink-0 items-center gap-2">
                                            <button
                                              type="button"
                                              onClick={() => startEditAdvance(advance)}
                                              aria-label={`Edit ${advance.type}`}
                                              className="text-gray-400 hover:text-brand-orange transition"
                                            >
                                              <FontAwesomeIcon icon={faPen} className="h-3 w-3" />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => void removeAdvance(advance.id)}
                                              aria-label={`Remove ${advance.type}`}
                                              className="text-gray-400 hover:text-red-600 transition"
                                            >
                                              <FontAwesomeIcon icon={faTrash} className="h-3 w-3" />
                                            </button>
                                          </span>
                                        </li>
                                      ),
                                    )}
                                  </ul>
                                </div>,
                                document.body,
                              )}
                            {openAdvanceFor === projection.employeeId && advancePopoverAnchor && (
                              <SalaryEntryPopover
                                anchor={advancePopoverAnchor}
                                label="Reason"
                                options={ADVANCE_TYPE_OPTIONS}
                                type={advanceDraftType}
                                customType={advanceDraftCustomType}
                                amount={advanceDraftAmount}
                                amountLabel="Amount"
                                error={advanceDraftError}
                                saving={savingAdvance}
                                onTypeChange={(value) => { setAdvanceDraftType(value); setAdvanceDraftError(undefined); }}
                                onCustomTypeChange={(value) => { setAdvanceDraftCustomType(value); setAdvanceDraftError(undefined); }}
                                onAmountChange={(value) => { setAdvanceDraftAmount(value); setAdvanceDraftError(undefined); }}
                                onClose={closeAdvancePopover}
                                onSubmit={() => void addAdvance(projection.employeeId)}
                              />
                            )}
                            {false && openAdvanceFor === projection.employeeId &&
                              advancePopoverAnchor &&
                              createPortal(
                                <>
                                  <button
                                    type="button"
                                    aria-label="Close advance popover"
                                    className="fixed inset-0 z-[9998] cursor-default"
                                    onClick={closeAdvancePopover}
                                  />
                                  <div
                                    className="fixed z-[9999] w-72 -translate-y-full rounded-xl border border-brand-beige bg-white p-4 shadow-[0_20px_45px_rgba(36,50,58,0.25)] text-left"
                                    style={{ top: advancePopoverAnchor!.top - 8, left: advancePopoverAnchor!.left }}
                                  >
                                    <div className="space-y-3">
                                      <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Reason</label>
                                        <select
                                          value={advanceDraftType}
                                          onChange={(event) => { setAdvanceDraftType(event.target.value); setAdvanceDraftError(undefined); }}
                                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-brand-orange focus:border-brand-orange"
                                        >
                                          {ADVANCE_TYPE_OPTIONS.map((option) => (
                                            <option key={option} value={option}>{option}</option>
                                          ))}
                                        </select>
                                        {advanceDraftType === "Other" && (
                                          <input
                                            type="text"
                                            value={advanceDraftCustomType}
                                            onChange={(event) => { setAdvanceDraftCustomType(event.target.value); setAdvanceDraftError(undefined); }}
                                            placeholder="Enter reason"
                                            className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-orange focus:border-brand-orange"
                                          />
                                        )}
                                      </div>
                                      <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Amount</label>
                                        <input
                                          type="text"
                                          inputMode="decimal"
                                          value={advanceDraftAmount}
                                          onChange={(event) => { setAdvanceDraftAmount(event.target.value.replaceAll(/[^\d.]/g, "")); setAdvanceDraftError(undefined); }}
                                          placeholder="0.00"
                                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-orange focus:border-brand-orange"
                                        />
                                      </div>
                                      {advanceDraftError && (
                                        <p className="text-xs text-red-600" role="alert">{advanceDraftError}</p>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => void addAdvance(projection.employeeId)}
                                        disabled={savingAdvance}
                                        className="w-full bg-brand-orange text-white text-sm font-medium px-3 py-2 rounded-lg hover:bg-brand-orange/90 transition disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        {savingAdvance ? "Saving…" : "Add"}
                                      </button>
                                    </div>
                                  </div>
                                </>,
                                document.body,
                              )}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-5 py-3.5 text-gray-600">
                          {formatCurrency(projection.earnedSalary)} / <span className="font-semibold text-brand-orange">{formatCurrency(projection.projectedSalary)}</span>
                        </td>
                        <td className="whitespace-nowrap px-5 py-3.5 text-right">
                          <button
                            type="button"
                            onClick={() => void downloadSlip(projection.employeeId, projection.name)}
                            disabled={downloadingSlipFor === projection.employeeId}
                            aria-label={`Download ${projection.name}'s salary slip`}
                            title="Download slip"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-brand-teal hover:bg-brand-teal/10 transition disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {downloadingSlipFor === projection.employeeId ? (
                              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand-teal border-t-transparent" />
                            ) : (
                              <FontAwesomeIcon icon={faDownload} className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          </>
          )}
        </>
      ) : null}

    </div>
  );
}
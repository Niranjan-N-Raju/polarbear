"use client";

import { useCallback, useEffect, useState } from "react";
import {
  faArrowUp,
  faArrowDown,
  faScaleBalanced,
} from "@fortawesome/free-solid-svg-icons";
import { PencilIcon, TrashIcon } from "@/app/components/icons";
import { SummaryCard } from "@/app/components/SummaryCard";
import { MobileSummaryDrawer } from "@/app/components/MobileSummaryDrawer";
import { MonthPicker } from "@/app/components/MonthPicker";
import { useToast } from "@/app/hooks/useToast";
import { useStoreModal } from "@/app/(app)/store-context";
import type { WithdrawalRecord } from "@/types/withdrawals";
import { withdrawalsRequest } from "../apicall/withdrawals";
import { currentMonthRange, formatCurrency, formatDate } from "../utils";
import { WithdrawalFormDrawer } from "./WithdrawalFormDrawer";

export default function WithdrawalsPage() {
  const { activeStoreId } = useStoreModal();
  useEffect(() => { document.title = "Withdrawals · Polar Bear"; }, []);
  const { error, success } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [editingRecord, setEditingRecord] = useState<WithdrawalRecord | null>(null);
  const [records, setRecords] = useState<WithdrawalRecord[]>([]);
  const [allTimeWithdrawals, setAllTimeWithdrawals] = useState(0);
  const [allTimeRepayments, setAllTimeRepayments] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => currentMonthRange().from.slice(0, 7));
  const [year, month] = selectedMonth.split("-").map(Number);
  const dateFrom = `${selectedMonth}-01`;
  const dateTo = `${selectedMonth}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}`;
  const [removingId, setRemovingId] = useState<string | null>(null);

  const loadRecords = useCallback(async () => {
    if (!activeStoreId) {
      setRecords([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await withdrawalsRequest(
        `/api/withdrawals?franchiseId=${encodeURIComponent(activeStoreId)}&from=${dateFrom}&to=${dateTo}`,
      );
      const data = (await response.json()) as { withdrawals?: WithdrawalRecord[]; totalWithdrawals?: number; totalRepayments?: number; message?: string };
      if (!response.ok) throw new Error(data.message ?? "Failed to load entries.");
      setRecords(data.withdrawals ?? []);
      setAllTimeWithdrawals(data.totalWithdrawals ?? 0);
      setAllTimeRepayments(data.totalRepayments ?? 0);
    } catch (loadError) {
      error(loadError instanceof Error ? loadError.message : "Failed to load entries.");
    } finally {
      setLoading(false);
    }
  }, [activeStoreId, dateFrom, dateTo, error]);

  useEffect(() => {
    queueMicrotask(() => void loadRecords());
  }, [loadRecords]);

  async function removeRecord(record: WithdrawalRecord) {
    if (!activeStoreId) return;
    if (!globalThis.confirm("Remove this entry? This action cannot be undone.")) return;
    setRemovingId(record.id);
    try {
      const response = await withdrawalsRequest(
        `/api/withdrawals/${record.id}?franchiseId=${encodeURIComponent(activeStoreId)}`,
        { method: "DELETE" },
      );
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message ?? "Failed to remove entry.");
      success(data.message ?? "Entry removed.");
      await loadRecords();
    } catch (removeError) {
      error(removeError instanceof Error ? removeError.message : "Failed to remove entry.");
    } finally {
      setRemovingId(null);
    }
  }

  const totalWithdrawals = records.filter((r) => r.type === "withdrawal").reduce((sum, r) => sum + r.amount, 0);
  const totalRepayments = records.filter((r) => r.type === "repayment").reduce((sum, r) => sum + r.amount, 0);
  const net = totalWithdrawals - totalRepayments;

  const summaryCards = [
    { label: "Month Withdrawals", value: formatCurrency(totalWithdrawals), color: "orange" as const, icon: faArrowUp },
    { label: "Repayments", value: formatCurrency(totalRepayments), color: "teal" as const, icon: faArrowDown },
    { label: "Net Outstanding", value: formatCurrency(net), color: net > 0 ? ("orange" as const) : ("teal" as const), icon: faScaleBalanced },
    { label: "All-Time Withdrawals", value: formatCurrency(allTimeWithdrawals), color: "orange" as const, icon: faArrowUp },
    { label: "All-Time Repayments", value: formatCurrency(allTimeRepayments), color: "teal" as const, icon: faArrowDown },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-brand-beige bg-white/80 p-6 shadow-[0_10px_30px_rgba(36,50,58,0.05)]">
        <div>
          <p className="hidden text-xs font-semibold uppercase tracking-[0.18em] text-brand-orange sm:block">
            Store operations
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-gray-900">Withdrawals</h2>
          <p className="mt-2 text-sm text-gray-500">
            Track money withdrawn from the store (e.g. after P&amp;L) and any repayments.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          disabled={!activeStoreId}
          className="shrink-0 whitespace-nowrap rounded-lg bg-brand-orange px-4 py-2 text-sm font-medium text-white hover:bg-brand-orange/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          + Add Entry
        </button>
      </div>

      {!activeStoreId ? (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-500">
          Select a store to view withdrawals.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4">
            <label className="block w-56 max-w-full">
              <span className="mb-1 block text-xs font-medium text-gray-500">Month</span>
              <MonthPicker value={selectedMonth} onChange={setSelectedMonth} />
            </label>
          </div>

          <div className="hidden gap-3 sm:grid sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 2xl:grid-cols-5">
            {summaryCards.map((card) => (
              <SummaryCard key={card.label} label={card.label} value={card.value} color={card.color} icon={card.icon} />
            ))}
          </div>
          <MobileSummaryDrawer cards={summaryCards} title="Withdrawals Summary" />

          <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            {loading ? (
              <div className="flex justify-center py-20">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-orange border-t-transparent" />
              </div>
            ) : records.length === 0 ? (
              <p className="px-6 py-14 text-center text-sm text-gray-500">No entries in this date range.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-brand-sand/50 border-b border-brand-beige">
                      <th className="text-left px-5 py-3 font-semibold text-gray-600">Date</th>
                      <th className="text-left px-5 py-3 font-semibold text-gray-600">Type</th>
                      <th className="text-left px-5 py-3 font-semibold text-gray-600">Amount</th>
                      <th className="text-left px-5 py-3 font-semibold text-gray-600">Reason</th>
                      <th className="text-right px-5 py-3 font-semibold text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-beige/60">
                    {records.map((record) => (
                      <tr key={record.id} className="hover:bg-brand-sand/20 transition">
                        <td className="px-5 py-3.5 text-gray-900">{formatDate(record.date)}</td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                              record.type === "withdrawal" ? "bg-brand-peach text-brand-orange" : "bg-brand-teal/10 text-brand-teal"
                            }`}
                          >
                            {record.type === "withdrawal" ? "Withdrawal" : "Repayment"}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 font-medium text-gray-900">{formatCurrency(record.amount)}</td>
                        <td className="px-5 py-3.5 max-w-xs truncate text-gray-600">{record.reason || "—"}</td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-end gap-3">
                            <button
                              type="button"
                              onClick={() => setEditingRecord(record)}
                              aria-label="Edit entry"
                              className="text-gray-400 hover:text-brand-orange transition"
                            >
                              <PencilIcon className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void removeRecord(record)}
                              disabled={removingId === record.id}
                              aria-label="Remove entry"
                              className="text-gray-400 hover:text-red-600 transition disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
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

      {showAdd && (
        <WithdrawalFormDrawer
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); void loadRecords(); }}
        />
      )}
      {editingRecord && (
        <WithdrawalFormDrawer
          editRecord={editingRecord}
          onClose={() => setEditingRecord(null)}
          onSaved={() => { setEditingRecord(null); void loadRecords(); }}
        />
      )}
    </div>
  );
}

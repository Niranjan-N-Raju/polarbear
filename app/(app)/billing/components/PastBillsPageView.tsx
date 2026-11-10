"use client";

import { faChevronLeft, faChevronRight, faFilter, faReceipt, faRotateRight } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useStoreModal } from "../../store-context";
import { DatePicker } from "@/app/components/DatePicker";
import { appFetch } from "@/lib/api-client";
import { DEFAULT_TABLES, formatINR, type BillSummary, type SavedBill } from "@/lib/billing";
import { businessDateValue, isValidDate } from "@/lib/date-utils";
import { BillReceipt } from "./BillReceipt";
import { TokenSelect } from "./TokenSelect";

interface HistoryFilters { from: string; to: string; orderType: string; tableNumber: string; search: string }
interface HistoryData { storeName: string; bills: BillSummary[]; tables: string[]; total: number; page: number; pageSize: number; totalPages: number }
const inputClass = "w-full min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-orange focus:outline-none focus:ring-1 focus:ring-brand-orange";
const buttonClass = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60";
const defaults = (today: string): HistoryFilters => ({ from: today, to: today, orderType: "", tableNumber: "", search: "" });

export default function PastBillsPageView({ today }: { today: string }) {
  const { activeStoreId, openStoreModal } = useStoreModal();
  if (!activeStoreId) return (
    <div className="space-y-8"><header className="rounded-2xl border border-brand-beige bg-white/80 p-6 shadow-[0_10px_30px_rgba(36,50,58,0.05)]"><p className="hidden text-xs font-semibold uppercase text-brand-teal sm:block">Point of Sale</p><h1 className="mt-2 text-3xl font-semibold text-gray-900">Billing History</h1></header><div className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center"><button type="button" onClick={openStoreModal} className={buttonClass}>Select store</button></div></div>
  );
  return <PastBillsWorkspace key={`${activeStoreId}:${today}`} storeId={activeStoreId} today={today} />;
}

function PastBillsWorkspace({ storeId, today }: { storeId: string; today: string }) {
  const [filters, setFilters] = useState<HistoryFilters>(() => defaults(today));
  const [applied, setApplied] = useState<HistoryFilters>(() => defaults(today));
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [history, setHistory] = useState<HistoryData | null>(null);
  const [tables, setTables] = useState(DEFAULT_TABLES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterError, setFilterError] = useState("");
  const [receipt, setReceipt] = useState<SavedBill | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const receiptRequest = useRef<AbortController | null>(null);
  const receiptContainer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setHistory(null);
    const query = new URLSearchParams({ storeId, view: "history", ...applied, page: String(page) });
    appFetch(`/api/bills?${query}`, { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json() as HistoryData & { message?: string };
        if (!response.ok || !Array.isArray(result.bills) || !Array.isArray(result.tables)) throw new Error(result.message ?? "Unable to load billing history.");
        if (!controller.signal.aborted) { setHistory(result); setTables(result.tables); }
      })
      .catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Unable to load billing history."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [storeId, applied, page, reloadKey]);

  useEffect(() => () => receiptRequest.current?.abort(), []);
  useEffect(() => { if (receipt) receiptContainer.current?.focus(); }, [receipt]);

  function closeReceipt() {
    receiptRequest.current?.abort();
    setOpeningId(null);
    setReceipt(null);
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isValidDate(filters.from) || !isValidDate(filters.to) || filters.from > filters.to) {
      setFilterError("Choose a valid date range with the start date on or before the end date.");
      return;
    }
    setFilterError("");
    closeReceipt();
    setPage(1);
    setApplied({ ...filters, search: filters.search.trim() });
  }

  function showToday() {
    const next = defaults(businessDateValue());
    setFilters(next);
    setApplied(next);
    setPage(1);
    setFilterError("");
    closeReceipt();
  }

  async function openReceipt(billId: string) {
    receiptRequest.current?.abort();
    const controller = new AbortController();
    receiptRequest.current = controller;
    setOpeningId(billId);
    setError("");
    try {
      const query = new URLSearchParams({ storeId, billId });
      const response = await appFetch(`/api/bills?${query}`, { signal: controller.signal });
      const result = await response.json() as { bill?: SavedBill; message?: string };
      if (!response.ok || !result.bill) throw new Error(result.message ?? "Unable to open bill.");
      if (!controller.signal.aborted) setReceipt(result.bill);
    } catch (reason) { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Unable to open bill."); }
    finally { if (!controller.signal.aborted) setOpeningId(null); }
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-brand-beige bg-white/80 p-6 shadow-[0_10px_30px_rgba(36,50,58,0.05)] print:hidden">
        <div><p className="hidden text-xs font-semibold uppercase text-brand-teal sm:block">Point of Sale</p><h1 className="mt-2 text-3xl font-semibold text-gray-900">Billing History</h1>{history?.storeName && <p className="mt-2 text-sm text-gray-500">{history.storeName}</p>}</div>
        <button type="button" title="Refresh billing history" aria-label="Refresh billing history" disabled={loading} onClick={() => { closeReceipt(); setReloadKey((current) => current + 1); }} className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-60"><FontAwesomeIcon icon={faRotateRight} className={loading ? "animate-spin" : ""} aria-hidden="true" /></button>
      </header>

      <section className="rounded-xl border border-gray-200 bg-white p-6 print:hidden" aria-labelledby="bill-filters-title">
        <div className="mb-5 border-b border-gray-100 pb-4"><h2 id="bill-filters-title" className="font-semibold text-gray-900">Filters</h2></div>
        <form onSubmit={applyFilters} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <label className="min-w-0"><span className="mb-1 block text-sm font-medium text-gray-700">From date</span><DatePicker value={filters.from} onChange={(from) => setFilters((current) => ({ ...current, from }))} className={inputClass} /></label>
            <label className="min-w-0"><span className="mb-1 block text-sm font-medium text-gray-700">To date</span><DatePicker value={filters.to} onChange={(to) => setFilters((current) => ({ ...current, to }))} className={inputClass} /></label>
            <label className="min-w-0">
              <span className="mb-1 block text-sm font-medium text-gray-700">Order type</span>
              <select value={filters.orderType} onChange={(event) => setFilters((current) => ({ ...current, orderType: event.target.value }))} className={inputClass}>
                <option value="">All orders</option>
                <option value="dineIn">Dine-in</option>
                <option value="takeAway">Takeaway</option>
              </select>
            </label>
            <div className="min-w-0"><span className="mb-1 block text-sm font-medium text-gray-700">Token</span><TokenSelect tokens={tables} value={filters.tableNumber} emptyLabel="All tokens" className="w-full" onChange={(tableNumber) => setFilters((current) => ({ ...current, tableNumber }))} /></div>
            <label className="min-w-0"><span className="mb-1 block text-sm font-medium text-gray-700">Bill number</span><input type="search" maxLength={80} value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Search bill number" className={inputClass} /></label>
          </div>
          {filterError && <p role="alert" className="text-sm text-red-700">{filterError}</p>}
          <div className="flex flex-wrap gap-3"><button type="submit" className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-brand-orange px-4 py-2 text-sm font-medium text-white hover:bg-brand-orange/90"><FontAwesomeIcon icon={faFilter} aria-hidden="true" /> Apply filters</button><button type="button" onClick={showToday} className={buttonClass}>Reset to today</button></div>
        </form>
      </section>

      {error && <p role="alert" className="text-sm text-red-700 print:hidden">{error} <button type="button" onClick={() => setReloadKey((current) => current + 1)} className="underline">Retry</button></p>}
      {receipt && <div ref={receiptContainer} tabIndex={-1} className="outline-none"><BillReceipt bill={receipt} onClose={closeReceipt} /></div>}
      <section className="space-y-5 rounded-xl border border-gray-200 bg-white p-6 print:hidden" aria-labelledby="past-bills-title">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4"><h2 id="past-bills-title" className="font-semibold text-gray-900">Bills</h2><span className="text-sm text-gray-500">{applied.from === applied.to ? applied.from : `${applied.from} to ${applied.to}`} (IST)</span></div>
        {loading ? <div role="status" className="flex justify-center py-16"><span className="sr-only">Loading bills...</span><span className="h-8 w-8 animate-spin rounded-full border-4 border-brand-orange border-t-transparent" /></div> : history && !history.bills.length ? <p className="py-12 text-center text-sm text-gray-500">No bills match these filters.</p> : history ? (
          <>
            <div className="overflow-x-auto rounded-lg border border-gray-200"><table className="w-full min-w-[640px] text-sm"><thead className="border-b border-brand-beige bg-brand-sand/50 text-left text-xs font-semibold text-gray-600"><tr><th scope="col" className="px-4 py-3.5">Bill number</th><th scope="col" className="px-4 py-3.5">Order / Token</th><th scope="col" className="px-4 py-3.5">Date & time</th><th scope="col" className="px-4 py-3.5 text-right">Total</th><th scope="col" className="px-4 py-3.5 text-right">Details</th></tr></thead><tbody className="divide-y divide-gray-100">{history.bills.map((bill) => <tr key={bill._id} className="hover:bg-brand-sand/30"><td className="px-4 py-3.5 font-medium text-gray-900"><button type="button" disabled={openingId !== null} onClick={() => void openReceipt(bill._id)} className="text-left hover:text-brand-orange hover:underline">{bill.billNumber}</button></td><td className="px-4 py-3.5">{bill.orderType === "dineIn" ? "Dine-in" : "Takeaway"} / {bill.tableNumber ? `Token ${bill.tableNumber}` : "Token not recorded"}</td><td className="px-4 py-3.5">{new Date(bill.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</td><td className="whitespace-nowrap px-4 py-3.5 text-right">{formatINR(bill.totalPaise)}</td><td className="px-4 py-3.5 text-right"><button type="button" title="View bill details" aria-label={`View ${bill.billNumber}`} disabled={openingId !== null} onClick={() => void openReceipt(bill._id)} className="inline-flex h-9 w-9 items-center justify-center rounded-md text-brand-teal hover:bg-brand-cyan/10 disabled:opacity-50"><FontAwesomeIcon icon={openingId === bill._id ? faRotateRight : faReceipt} className={openingId === bill._id ? "animate-spin" : ""} aria-hidden="true" /></button></td></tr>)}</tbody></table></div>
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600">
              <p>{(history.page - 1) * history.pageSize + 1} - {Math.min(history.page * history.pageSize, history.total)} of {history.total} bills</p>
              <div className="flex items-center gap-3">
                <button type="button" title="Previous page" aria-label="Previous page" disabled={page <= 1} onClick={() => { closeReceipt(); setPage((current) => current - 1); }} className={buttonClass}><FontAwesomeIcon icon={faChevronLeft} aria-hidden="true" /></button>
                <span>Page {history.page} of {history.totalPages}</span>
                <button type="button" title="Next page" aria-label="Next page" disabled={page >= history.totalPages || page >= 10000} onClick={() => { closeReceipt(); setPage((current) => current + 1); }} className={buttonClass}><FontAwesomeIcon icon={faChevronRight} aria-hidden="true" /></button>
              </div>
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}
"use client";

import { faBagShopping, faCartShopping, faMagnifyingGlass, faMinus, faPlus, faReceipt, faTrash, faUtensils, faXmark } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useStoreModal } from "../../store-context";
import { appFetch } from "@/lib/api-client";
import { billTotals, formatINR, pricePaise, type BillCustomer, type BillingProduct, type SavedBill } from "@/lib/billing";
import { BillReceipt } from "./BillReceipt";
import { TokenSelect } from "./TokenSelect";

const inputClass = "w-full min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-orange focus:outline-none focus:ring-1 focus:ring-brand-orange";
const buttonClass = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60";
const primaryClass = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-brand-orange px-4 py-2 text-sm font-medium text-white hover:bg-brand-orange/90 disabled:opacity-60";
const emptyCustomer: BillCustomer = { mobile: "", firstName: "", middleName: "", lastName: "" };

interface BillingData { storeName: string; products: BillingProduct[]; tables: string[] }

function QuantityStepper({ name, quantity, disabled, onChange }: {
  name: string;
  quantity: number;
  disabled: boolean;
  onChange: (quantity: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <span className="inline-grid grid-cols-[36px_48px_36px] items-center border border-gray-200 bg-white">
      <button type="button" title="Decrease quantity" aria-label={`Decrease ${name} quantity`} disabled={disabled} onClick={() => { setDraft(null); onChange(quantity - 1); }} className="inline-flex h-9 items-center justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-40"><FontAwesomeIcon icon={faMinus} aria-hidden="true" /></button>
      <input type="text" inputMode="numeric" pattern="[0-9]{1,3}" maxLength={3} aria-label={`${name} quantity`} disabled={disabled} value={draft ?? String(quantity)} onFocus={(event) => event.currentTarget.select()} onChange={(event) => {
        const text = event.target.value;
        if (!/^\d{0,3}$/.test(text)) return;
        setDraft(text);
        const next = Number(text);
        if (next >= 1 && next <= 999) onChange(next);
      }} onBlur={() => setDraft(null)} className="h-9 w-full border-x border-gray-200 bg-transparent text-center text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-orange" />
      <button type="button" title="Increase quantity" aria-label={`Increase ${name} quantity`} disabled={disabled || quantity >= 999} onClick={() => { setDraft(null); onChange(quantity + 1); }} className="inline-flex h-9 items-center justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-40"><FontAwesomeIcon icon={faPlus} aria-hidden="true" /></button>
    </span>
  );
}

async function requestJson<ResponseBody>(url: string, init?: RequestInit): Promise<ResponseBody> {
  const response = await appFetch(url, init);
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok || !data || typeof data !== "object") {
    const message = data && typeof data === "object" ? (data as { message?: unknown }).message : null;
    throw new Error(typeof message === "string" ? message : "Unable to complete this request.");
  }
  return data as ResponseBody;
}

export default function BillingPageView() {
  const { activeStoreId, openStoreModal } = useStoreModal();
  if (!activeStoreId) return (
    <div className="space-y-8">
      <header className="rounded-2xl border border-brand-beige bg-white/80 p-6 shadow-[0_10px_30px_rgba(36,50,58,0.05)]"><p className="hidden text-xs font-semibold uppercase text-brand-teal sm:block">Point of Sale</p><h1 className="mt-2 text-3xl font-semibold text-gray-900">New Order</h1></header>
      <div className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center"><button type="button" className={primaryClass} onClick={openStoreModal}>Select store</button></div>
    </div>
  );
  return <BillingWorkspace key={activeStoreId} storeId={activeStoreId} />;
}

function BillingWorkspace({ storeId }: { storeId: string }) {
  const [data, setData] = useState<BillingData>({ storeName: "", products: [], tables: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [orderType, setOrderType] = useState<"dineIn" | "takeAway">("dineIn");
  const [tableNumber, setTableNumber] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [includeCustomer, setIncludeCustomer] = useState(false);
  const [customer, setCustomer] = useState<BillCustomer>({ ...emptyCustomer });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const requestId = useRef("");
  const summaryRef = useRef<HTMLFieldSetElement>(null);
  const [summaryVisible, setSummaryVisible] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [receipt, setReceipt] = useState<SavedBill | null>(null);
  const started = receipt === null;
  const storeQuery = new URLSearchParams({ storeId }).toString();

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError("");
    requestJson<BillingData>(`/api/bills?${storeQuery}`, { signal: controller.signal })
      .then((result) => {
        if (!Array.isArray(result.products) || !Array.isArray(result.tables)) throw new Error("Unable to load the billing menu.");
        if (!controller.signal.aborted) setData(result);
      })
      .catch((reason: unknown) => { if (!controller.signal.aborted) setLoadError(reason instanceof Error ? reason.message : "Unable to load billing."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [storeQuery, reloadKey]);

  useEffect(() => {
    const summary = summaryRef.current;
    if (!summary || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setSummaryVisible(entry.isIntersecting), { threshold: 0.1 });
    observer.observe(summary);
    return () => observer.disconnect();
  }, [started, orderType]);

  function startBill() {
    requestId.current = "";
    setOrderType("dineIn");
    setTableNumber("");
    setQuantities({});
    setCustomer({ ...emptyCustomer });
    setIncludeCustomer(false);
    setSearch("");
    setCategory("");
    setError("");
    setReceipt(null);
    setConfirmDiscard(false);
  }

  const rows = Object.entries(quantities).map(([productId, quantity]) => {
    const product = data.products.find((candidate) => candidate._id === productId);
    return { productId, quantity, product, unitPricePaise: pricePaise(product?.price) };
  });
  const totals = billTotals(rows.reduce((sum, row) => sum + (row.unitPricePaise ?? 0) * row.quantity, 0));
  const invalidCart = rows.some((row) => row.unitPricePaise === null);
  const itemCount = rows.reduce((sum, row) => sum + row.quantity, 0);
  const categories = [...new Set(data.products.map((product) => product.category))].sort();
  const visibleProducts = data.products.filter((product) => (!category || category === product.category) && product.name.toLowerCase().includes(search.trim().toLowerCase()));

  function changeQuantity(productId: string, quantity: number) {
    setError("");
    setQuantities((current) => {
      const next = { ...current };
      if (quantity <= 0) delete next[productId];
      else if (current[productId] || Object.keys(current).length < 100) next[productId] = Math.min(999, quantity);
      return next;
    });
  }

  async function saveBill(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingRef.current) return;
    if (!tableNumber || !rows.length || invalidCart) {
      setError("Choose a serving token and at least one priced product.");
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError("");
    try {
      if (!requestId.current) requestId.current = (await requestJson<{ requestId: string }>(`/api/bills?${storeQuery}&newRequest=true`)).requestId;
      const result = await requestJson<{ bill: SavedBill }>(`/api/bills?${storeQuery}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: requestId.current, orderType, tableNumber, items: rows.map((row) => ({ productId: row.productId, quantity: row.quantity })), expectedSubtotalPaise: totals.subtotalPaise, customer: includeCustomer ? customer : null }),
      });
      setReceipt(result.bill);
      setQuantities({});
      setCustomer({ ...emptyCustomer });
      requestId.current = "";
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save bill.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <div className={`space-y-8 ${started && rows.length ? "pb-20 lg:pb-0" : ""}`}>
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-brand-beige bg-white/80 p-6 shadow-[0_10px_30px_rgba(36,50,58,0.05)] print:hidden">
        <div><p className="hidden text-xs font-semibold uppercase text-brand-teal sm:block">Point of Sale</p><h1 className="mt-2 text-3xl font-semibold text-gray-900">New Order</h1>{data.storeName && <p className="mt-2 text-sm text-gray-500">{data.storeName}</p>}</div>
        {started ? <fieldset disabled={saving || loading} className="flex min-w-0 flex-wrap items-center gap-3">
          <legend className="sr-only">Order details</legend>
          <div className="inline-flex max-w-full gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1" role="radiogroup" aria-label="Order type">
            {(["dineIn", "takeAway"] as const).map((mode) => <label key={mode} className={`inline-flex min-h-9 cursor-pointer items-center gap-2 whitespace-nowrap rounded-md border px-3 py-1.5 text-sm font-medium has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand-orange ${orderType === mode ? "border-brand-orange bg-brand-peach text-brand-orange" : "border-transparent text-gray-700 hover:bg-white"}`}><input required form="new-order-form" className="sr-only" type="radio" name="orderType" value={mode} checked={orderType === mode} onChange={() => { setOrderType(mode); setError(""); }} /><FontAwesomeIcon icon={mode === "dineIn" ? faUtensils : faBagShopping} aria-hidden="true" />{mode === "dineIn" ? "Dine-in" : "Takeaway"}</label>)}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Token</span>
            <TokenSelect required formId="new-order-form" tokens={data.tables} value={tableNumber} disabled={saving || loading} onChange={(token) => { setTableNumber(token); setError(""); }} />
          </div>
        </fieldset> : <button type="button" className={primaryClass} disabled={loading || Boolean(loadError)} onClick={startBill}><FontAwesomeIcon icon={faPlus} aria-hidden="true" /> New order</button>}
      </header>

      {error && <p role="alert" className="text-sm text-red-700 print:hidden">{error}</p>}
      {loadError && <p role="alert" className="text-sm text-red-700 print:hidden">{loadError} <button type="button" className="underline" onClick={() => setReloadKey((current) => current + 1)}>Retry</button></p>}
      {loading && <div role="status" className="flex justify-center py-20 print:hidden"><span className="sr-only">Loading billing...</span><span className="h-8 w-8 animate-spin rounded-full border-4 border-brand-orange border-t-transparent" /></div>}

      {receipt && <BillReceipt bill={receipt} />}

      {started && <form id="new-order-form" onSubmit={(event) => void saveBill(event)} className="space-y-4 print:hidden">
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px]">
          <fieldset disabled={saving || loading} className="min-w-0 space-y-5 rounded-xl border border-gray-200 bg-white p-6">
            <legend className="sr-only">Menu</legend>
            <div className="flex items-center justify-between gap-3 border-b border-gray-100 pb-4"><h2 className="font-semibold text-gray-900">Menu</h2><span className="text-xs text-gray-500">{visibleProducts.length} products</span></div>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
              <label className="relative min-w-0"><span className="sr-only">Search products</span><FontAwesomeIcon icon={faMagnifyingGlass} aria-hidden="true" className="pointer-events-none absolute left-3 top-3 text-sm text-gray-400" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products" className={`${inputClass} pl-9`} /></label>
              <label className="min-w-0"><span className="sr-only">Category</span><select value={category} onChange={(event) => setCategory(event.target.value)} className={inputClass}><option value="">All categories</option>{categories.map((name) => <option key={name}>{name}</option>)}</select></label>
            </div>
            {!data.products.length ? <p className="py-8 text-sm text-gray-500">No menu products available.</p> : !visibleProducts.length ? <p className="py-8 text-sm text-gray-500">No matching products.</p> : <div className="divide-y divide-gray-100 border-y border-gray-100">{visibleProducts.map((product) => {
              const paise = pricePaise(product.price);
              const quantity = quantities[product._id] ?? 0;
              return <button key={product._id} type="button" disabled={paise === null || quantity >= 999 || (!quantity && rows.length >= 100)} aria-label={`Add ${product.name}${quantity ? `, ${quantity} in bill` : ""}`} onClick={() => changeQuantity(product._id, quantity + 1)} className={`flex min-h-20 w-full min-w-0 items-center justify-between gap-3 px-3 py-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-brand-orange disabled:opacity-50 ${quantity ? "bg-brand-peach/30" : "bg-white hover:bg-brand-sand/30"}`}>
                <span className="min-w-0"><span className="block break-words text-sm font-medium text-gray-900">{product.name}</span><span className="mt-1 block break-words text-xs text-gray-500">{product.category}</span></span>
                <span className="flex shrink-0 items-center gap-3"><span className="text-right"><span className="block text-sm font-medium text-gray-900">{paise === null ? "Price not set" : formatINR(paise)}</span>{quantity > 0 && <span className="mt-1 block text-xs text-brand-orange">Qty: {quantity}</span>}</span><span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-brand-orange text-brand-orange"><FontAwesomeIcon icon={faPlus} aria-hidden="true" /></span></span>
              </button>;
            })}</div>}
          </fieldset>

          <fieldset ref={summaryRef} id="current-bill-summary" disabled={saving || loading} className="min-w-0 scroll-mt-4 space-y-5 rounded-xl border border-gray-200 bg-white p-6 lg:sticky lg:top-4">
            <legend className="sr-only">Current bill</legend>
            <div className="flex items-center justify-between gap-3 border-b border-gray-100 pb-4"><div><h2 className="font-semibold text-gray-900">Current bill</h2><p className="mt-1 text-sm text-gray-500">{orderType === "dineIn" ? "Dine-in" : "Takeaway"} / {tableNumber ? `Token ${tableNumber}` : "No token selected"}</p></div><span className="text-xs font-medium text-gray-500" aria-live="polite">{itemCount} {itemCount === 1 ? "item" : "items"}</span></div>
            {!rows.length ? (
              <div className="flex min-h-40 flex-col items-center justify-center gap-3 text-gray-400"><FontAwesomeIcon icon={faCartShopping} className="text-2xl" aria-hidden="true" /><p className="text-sm">No items yet</p></div>
            ) : (
              <ul className="divide-y divide-gray-100 lg:max-h-[36vh] lg:overflow-y-auto lg:overscroll-contain lg:pr-1">
                {rows.map((row) => <li key={row.productId} className="space-y-3 py-4 first:pt-0">
                  <div className="flex items-start justify-between gap-3">
                    <span className="min-w-0"><span className="block break-words text-sm font-medium text-gray-900">{row.product?.name ?? "Unavailable product"}</span><span className="mt-1 block text-xs text-gray-500">{row.unitPricePaise === null ? "Price unavailable" : formatINR(row.unitPricePaise)}</span></span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">{row.unitPricePaise === null ? "Unavailable" : formatINR(row.unitPricePaise * row.quantity)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <QuantityStepper name={row.product?.name ?? "Product"} quantity={row.quantity} disabled={saving || loading} onChange={(quantity) => changeQuantity(row.productId, quantity)} />
                    <button type="button" title="Remove product" aria-label={`Remove ${row.product?.name ?? "product"}`} onClick={() => changeQuantity(row.productId, 0)} className="inline-flex h-9 w-9 items-center justify-center rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600"><FontAwesomeIcon icon={faTrash} aria-hidden="true" /></button>
                  </div>
                </li>)}
              </ul>
            )}
            <dl className="space-y-2 border-y border-gray-200 py-4 text-sm"><div className="flex justify-between gap-3"><dt>Subtotal</dt><dd>{formatINR(totals.subtotalPaise)}</dd></div><div className="flex justify-between gap-3"><dt>GST (5%)</dt><dd>{formatINR(totals.gstPaise)}</dd></div><div className="flex justify-between gap-3 pt-2 text-base font-semibold"><dt>Total</dt><dd>{formatINR(totals.totalPaise)}</dd></div></dl>
            <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={includeCustomer} onChange={(event) => setIncludeCustomer(event.target.checked)} /> Add customer details</label>
            {includeCustomer && <div className="grid gap-3 sm:grid-cols-2">{([['mobile', 'Mobile number'], ['firstName', 'First name'], ['middleName', 'Middle name'], ['lastName', 'Last name']] as const).map(([field, label]) => <label key={field} className="min-w-0"><span className="mb-1 block text-xs font-medium text-gray-600">{label}{field === "mobile" || field === "firstName" ? " *" : ""}</span><input type={field === "mobile" ? "tel" : "text"} inputMode={field === "mobile" ? "numeric" : "text"} autoComplete={field === "mobile" ? "tel-national" : field === "firstName" ? "given-name" : field === "middleName" ? "additional-name" : "family-name"} required={field === "mobile" || field === "firstName"} pattern={field === "mobile" ? "[0-9]{10}" : undefined} maxLength={field === "mobile" ? 10 : 80} value={customer[field]} onChange={(event) => setCustomer((current) => ({ ...current, [field]: event.target.value }))} className={inputClass} /></label>)}</div>}
            {totals.totalPaise > 100_000_000 && <p role="alert" className="text-sm text-red-700">The bill total cannot exceed INR 1,000,000.</p>}
            <div className="border-t border-gray-100 pt-4">
              {confirmDiscard ? (
                <div className="space-y-3">
                  <p role="alert" className="text-sm font-medium text-gray-700">Discard this bill?</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button type="button" disabled={saving} className={`${buttonClass} min-h-11 px-3`} onClick={() => setConfirmDiscard(false)}>Keep editing</button>
                    <button type="button" disabled={saving} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-red-600 bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60" onClick={startBill}>Discard bill</button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-3">
                  <button type="button" disabled={saving || loading} className={`${buttonClass} min-h-11 px-3`} onClick={() => setConfirmDiscard(true)}><FontAwesomeIcon icon={faXmark} aria-hidden="true" /> Cancel</button>
                  <button type="submit" disabled={saving || loading || !tableNumber || !rows.length || invalidCart || totals.totalPaise > 100_000_000} className={`${primaryClass} min-h-11 min-w-0 flex-1`}><FontAwesomeIcon icon={faReceipt} aria-hidden="true" />{saving ? "Saving..." : "Save bill"}</button>
                </div>
              )}
            </div>
          </fieldset>
        </div>
        {rows.length > 0 && !summaryVisible && <button type="button" aria-controls="current-bill-summary" onClick={() => summaryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })} className="fixed bottom-4 right-4 z-20 inline-flex min-h-12 max-w-[calc(100%-2rem)] items-center gap-4 rounded-lg bg-brand-orange px-5 py-3 text-sm font-semibold text-white shadow-lg hover:bg-brand-orange/90 lg:hidden"><FontAwesomeIcon icon={faCartShopping} aria-hidden="true" /><span>View bill ({itemCount})</span><span>{formatINR(totals.totalPaise)}</span></button>}
      </form>}

    </div>
  );
}
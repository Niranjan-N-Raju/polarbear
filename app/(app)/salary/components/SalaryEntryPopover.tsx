"use client";

import { createPortal } from "react-dom";
import { Checkbox } from "@/app/components/Checkbox";

type Props = {
  anchor: { top: number; left: number };
  label: string;
  options: readonly string[];
  type: string;
  customType: string;
  amount: string;
  amountLabel: string;
  paidEarly?: boolean;
  onPaidEarlyChange?: (value: boolean) => void;
  error?: string;
  saving: boolean;
  onTypeChange: (value: string) => void;
  onCustomTypeChange: (value: string) => void;
  onAmountChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
};

export default function SalaryEntryPopover({ anchor, label, options, type, customType, amount, amountLabel, paidEarly, onPaidEarlyChange, error, saving, onTypeChange, onCustomTypeChange, onAmountChange, onClose, onSubmit }: Readonly<Props>) {
  return createPortal(<><button type="button" aria-label={`Close ${label} popover`} className="fixed inset-0 z-[9998] cursor-default" onClick={onClose} /><div className="fixed z-[9999] w-72 -translate-y-full rounded-xl border border-brand-beige bg-white p-4 text-left shadow-[0_20px_45px_rgba(36,50,58,0.25)]" style={{ top: anchor.top - 8, left: anchor.left }}><div className="space-y-3"><div><label className="mb-1 block text-xs font-medium text-gray-700">{label}</label><select value={type} onChange={(event) => onTypeChange(event.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"><option value="">Select {label.toLowerCase()}</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select>{type === "Other" && <input type="text" value={customType} onChange={(event) => onCustomTypeChange(event.target.value)} placeholder={`Enter ${label.toLowerCase()}`} className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400" />}</div><div><label className="mb-1 block text-xs font-medium text-gray-700">{amountLabel}</label><input type="text" inputMode="decimal" value={amount} onChange={(event) => onAmountChange(event.target.value.replaceAll(/[^\d.]/g, ""))} placeholder="0.00" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400" /></div>{onPaidEarlyChange ? <label className="flex items-center gap-2 text-sm text-gray-700"><Checkbox checked={paidEarly ?? false} onChange={(event) => onPaidEarlyChange(event.target.checked)} disabled={saving} />Paid early</label> : null}{error && <p className="text-xs text-red-600" role="alert">{error}</p>}<button type="button" onClick={onSubmit} disabled={saving} className="w-full rounded-lg bg-brand-orange px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60">{saving ? "Saving…" : "Add"}</button></div></div></>, document.body);
}

"use client";

import { daysUntil } from "@/lib/inventory/view";
import type { InventoryItem } from "@/types/inventory";

type Props = { item: InventoryItem; busy: boolean | string; onQuickUse: (item: InventoryItem) => void; onUse: (item: InventoryItem) => void; onDump: (item: InventoryItem) => void; mobile?: boolean };
export default function InventoryActions({ item, busy, onQuickUse, onUse, onDump, mobile = false }: Props) {
  const expired = daysUntil(item.expiryDate) < 0;
  const itemBusy = busy === item._id;
  const disabled = busy === true || itemBusy;
  if (expired) return <button type="button" disabled={disabled} onClick={() => onDump(item)} className={`${mobile ? "w-full " : ""}bg-brand-orange px-3 py-3 text-sm font-medium text-white disabled:opacity-60`}>Mark dumped</button>;
  return <div className={`flex gap-3 ${mobile ? "w-full" : "justify-end"}`}><button type="button" disabled={disabled} onClick={() => onQuickUse(item)} className={`${mobile ? "flex-1 " : ""}border border-brand-cyan px-3 py-3 text-sm font-semibold text-brand-cyan disabled:opacity-60`}>{itemBusy ? "Updating…" : "Use 1"}</button>{item.quantity >= 2 && <button type="button" disabled={disabled} onClick={() => onUse(item)} className={`${mobile ? "flex-1 " : ""}bg-brand-orange px-3 py-3 text-sm font-semibold text-white disabled:opacity-60`}>Use multiple</button>}</div>;
}

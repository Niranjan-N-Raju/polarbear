"use client";

import { daysUntil, formatInventoryDate, formatInventoryQuantity } from "@/lib/inventory/view";
import type { InventoryItem } from "@/types/inventory";
import InventoryActions from "./InventoryActions";

type Props = { item: InventoryItem; busy: boolean | string; onQuickUse: (item: InventoryItem) => void; onUse: (item: InventoryItem) => void; onDump: (item: InventoryItem) => void; priority?: number };
export default function InventoryCard({ item, busy, onQuickUse, onUse, onDump, priority = 1 }: Props) {
  const days = daysUntil(item.expiryDate);
  return <div className="border border-gray-200 bg-white p-6 shadow-[0_3px_12px_rgba(31,41,43,0.04)]"><div className="flex items-start justify-between gap-4"><div><p className="text-xl font-semibold text-gray-900">{item.product}</p><p className="mt-2 text-lg font-medium text-brand-cyan">Priority #{String(priority).padStart(2, "0")}</p></div>{days >= 0 && days <= 1 && <span className="bg-brand-yellow px-3 py-2 text-sm font-semibold text-gray-900">Use now</span>}</div><div className="my-6 border-t border-gray-200" /><div className="grid grid-cols-2 gap-6"><div><p className="text-sm text-gray-500">Expiry</p><p className="mt-2 text-lg font-medium text-gray-900">{formatInventoryDate(item.expiryDate)}</p><p className="mt-1 text-base text-gray-500">{days < 0 ? "Expired" : `${days}d remaining`}</p></div><div><p className="text-sm text-gray-500">Quantity</p><p className="mt-2 text-2xl font-semibold text-gray-900">{formatInventoryQuantity(item.quantity)}</p></div></div><div className="my-6 border-t border-gray-200" /><InventoryActions item={item} busy={busy} onQuickUse={onQuickUse} onUse={onUse} onDump={onDump} mobile /></div>;
}

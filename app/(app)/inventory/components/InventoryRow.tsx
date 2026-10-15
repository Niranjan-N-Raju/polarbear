"use client";

import { daysUntil, formatInventoryDate, formatInventoryQuantity } from "@/lib/inventory/view";
import type { InventoryItem } from "@/types/inventory";
import InventoryActions from "./InventoryActions";

type Props = { item: InventoryItem; busy: boolean | string; onQuickUse: (item: InventoryItem) => void; onUse: (item: InventoryItem) => void; onDump: (item: InventoryItem) => void };
export default function InventoryRow({ item, busy, onQuickUse, onUse, onDump }: Props) {
  const days = daysUntil(item.expiryDate);
  return <tr className="transition hover:bg-brand-sand/20"><td className="px-5 py-3.5 text-xs font-semibold uppercase text-gray-500">{days < 0 ? "Expired" : days <= 7 ? "Urgent" : "Healthy"}</td><td className="px-5 py-3.5 font-medium text-gray-900">{item.product}</td><td className="px-5 py-3.5 text-gray-600">{formatInventoryDate(item.expiryDate)}</td><td className="px-5 py-3.5 text-gray-600">{days < 0 ? "Expired" : `${days} days`}</td><td className="px-5 py-3.5 text-gray-600">{formatInventoryQuantity(item.quantity)}</td><td className="px-5 py-3.5 text-right"><InventoryActions item={item} busy={busy} onQuickUse={onQuickUse} onUse={onUse} onDump={onDump} /></td></tr>;
}

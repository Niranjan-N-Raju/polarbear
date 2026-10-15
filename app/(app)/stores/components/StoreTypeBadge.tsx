import type { StoreType } from "@/types/common";

export function StoreTypeBadge({ storeType }: Readonly<{ storeType: StoreType }>) {
  if (storeType === "company") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-brand-teal/10 text-brand-teal border border-brand-teal/20">
        Company Store
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-brand-yellow/20 text-brand-orange border border-brand-yellow/40">
      Franchise Store
    </span>
  );
}

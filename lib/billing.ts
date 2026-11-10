export const DEFAULT_TABLES = Array.from({ length: 10 }, (_, index) => `T${index + 1}`);
export const GST_PERCENT = 5;

export interface BillingProduct {
  _id: string;
  name: string;
  category: string;
  price: number | null;
}

export interface BillCustomer {
  mobile: string;
  firstName: string;
  middleName: string;
  lastName: string;
}

export interface BillItem {
  productId: string;
  name: string;
  quantity: number;
  unitPricePaise: number;
  amountPaise: number;
}

export interface SavedBill {
  _id: string;
  billNumber: string;
  storeName: string;
  orderType: "dineIn" | "takeAway";
  tableNumber: string | null;
  items: BillItem[];
  subtotalPaise: number;
  gstPercent: number;
  gstPaise: number;
  totalPaise: number;
  customer: BillCustomer | null;
  createdAt: string;
}

export interface BillSummary {
  _id: string;
  billNumber: string;
  orderType: "dineIn" | "takeAway";
  tableNumber: string | null;
  totalPaise: number;
  createdAt: string;
}

export function pricePaise(price: unknown): number | null {
  if (typeof price !== "number" || !Number.isFinite(price) || price < 0.01 || price > 1_000_000) return null;
  const paise = Math.round(price * 100);
  return Math.abs(price * 100 - paise) < 0.000001 ? paise : null;
}

export function billTotals(subtotalPaise: number) {
  const gstPaise = Math.round(subtotalPaise * GST_PERCENT / 100);
  return { subtotalPaise, gstPercent: GST_PERCENT, gstPaise, totalPaise: subtotalPaise + gstPaise };
}

const rupeeFormatter = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });
export function formatINR(paise: number) {
  return rupeeFormatter.format(paise / 100);
}
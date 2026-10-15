export interface Product {
  _id: string;
  name: string;
  normalizedName: string;
}

export interface InventoryItem {
  _id: string;
  productId: string;
  product: string;
  quantity: number;
  expiryDate: string;
}

export type InventoryFilter = "all" | "expired" | "one_day" | "urgent" | "healthy";
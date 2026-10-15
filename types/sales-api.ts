export interface SaleExpenseInput {
  name?: string;
  amount?: number;
}

export interface SalePayload {
  franchiseId?: string;
  date?: string;
  totalSale?: number;
  swiggy?: number;
  zomato?: number;
  upi?: number;
  upiCharge?: number;
  expenses?: SaleExpenseInput[];
}

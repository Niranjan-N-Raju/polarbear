export interface SaleForm {
  date: string;
  totalSale: string;
  swiggy: string;
  zomato: string;
  upi: string;
  upiCharge: string;
}

export interface ExpenseItem {
  name: string;
  amount: string;
}

export interface SaleRecord {
  id: string;
  date: string;
  totalSale: number;
  swiggy: number;
  zomato: number;
  upi: number;
  upiCharge: number;
  cash: number;
  expenses: { name: string; amount: number }[];
  totalExpenses: number;
  bankingCash: number;
}

export interface DailySale {
  date: string;
  totalSale: number;
}
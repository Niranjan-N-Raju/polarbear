import { formatAmount } from "../utils";

interface SaleExpensesCellProps {
  expenses: { name: string; amount: number }[];
}

export function SaleExpensesCell({ expenses }: Readonly<SaleExpensesCellProps>) {
  const total = expenses.reduce((sum, item) => sum + item.amount, 0);
  return <span>{formatAmount(total)}</span>;
}

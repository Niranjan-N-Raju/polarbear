export type WithdrawalType = "withdrawal" | "repayment";

export interface WithdrawalForm {
  date: string;
  amount: string;
  type: WithdrawalType;
  reason: string;
}

export interface WithdrawalRecord {
  id: string;
  date: string;
  amount: number;
  type: WithdrawalType;
  reason: string;
}

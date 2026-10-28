import { validateRecordDate } from "@/lib/date-utils";
import { hasAtMostTwoDecimals } from "@/lib/validation";
import type { WithdrawalRecord } from "@/types/withdrawals";

export interface WithdrawalPayload {
  franchiseId?: string;
  date?: string;
  amount?: number;
  type?: string;
  reason?: string;
}

export function validateWithdrawalPayload(
  body: WithdrawalPayload,
): { value: Omit<WithdrawalRecord, "id"> } | { error: string } {
  const dateError = validateRecordDate(body.date);
  if (dateError) return { error: dateError };
  if (typeof body.amount !== "number" || !Number.isFinite(body.amount) || body.amount <= 0) {
    return { error: "A valid amount is required." };
  }
  if (!hasAtMostTwoDecimals(body.amount)) {
    return { error: "Amount can have at most 2 decimal places." };
  }
  if (body.type !== "withdrawal" && body.type !== "repayment") {
    return { error: "Type must be either withdrawal or repayment." };
  }
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (reason.length > 300) return { error: "Reason must be 300 characters or fewer." };
  return { value: { date: body.date as string, amount: body.amount, type: body.type, reason } };
}
import { DATE_PATTERN } from "@/lib/date-utils";
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
  if (!body.date || !DATE_PATTERN.test(body.date)) return { error: "A valid date is required." };
  if (typeof body.amount !== "number" || !Number.isFinite(body.amount) || body.amount <= 0) {
    return { error: "A valid amount is required." };
  }
  if (body.type !== "withdrawal" && body.type !== "repayment") {
    return { error: "Type must be either withdrawal or repayment." };
  }
  const reason = body.reason?.trim() ?? "";
  if (reason.length > 300) return { error: "Reason must be 300 characters or fewer." };
  return { value: { date: body.date, amount: body.amount, type: body.type, reason } };
}
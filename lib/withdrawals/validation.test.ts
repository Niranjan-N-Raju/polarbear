import { describe, it, expect } from "vitest";
import { validateWithdrawalPayload } from "@/lib/withdrawals/validation";

const validPayload = { date: "2026-10-16", amount: 100, type: "withdrawal" };

describe("validateWithdrawalPayload", () => {
  it.each(["withdrawal", "repayment"])("accepts %s and trims the reason", (type) => {
    expect(validateWithdrawalPayload({ ...validPayload, type, reason: "  Store funds  " })).toEqual({
      value: { ...validPayload, type, reason: "Store funds" },
    });
  });

  it("defaults the reason and excludes store identity from validated fields", () => {
    expect(validateWithdrawalPayload({ ...validPayload, franchiseId: "store-id" })).toEqual({
      value: { ...validPayload, reason: "" },
    });
  });

  it("preserves regex-only date validation", () => {
    expect(validateWithdrawalPayload({ ...validPayload, date: "2026-02-31" })).toEqual({
      value: { ...validPayload, date: "2026-02-31", reason: "" },
    });
    expect(validateWithdrawalPayload({ ...validPayload, date: "16-10-2026" })).toEqual({
      error: "A valid date is required.",
    });
  });

  it.each([undefined, 0, -1, Number.NaN, Number.POSITIVE_INFINITY])("rejects invalid amount %s", (amount) => {
    expect(validateWithdrawalPayload({ ...validPayload, amount })).toEqual({
      error: "A valid amount is required.",
    });
  });

  it("rejects unsupported types and overlong trimmed reasons", () => {
    expect(validateWithdrawalPayload({ ...validPayload, type: "other" })).toEqual({
      error: "Type must be either withdrawal or repayment.",
    });
    expect(validateWithdrawalPayload({ ...validPayload, reason: "a".repeat(301) })).toEqual({
      error: "Reason must be 300 characters or fewer.",
    });
    expect(validateWithdrawalPayload({ ...validPayload, reason: ` ${"a".repeat(300)} ` })).toHaveProperty("value");
  });

  it("preserves first-error precedence", () => {
    expect(validateWithdrawalPayload({})).toEqual({ error: "A valid date is required." });
    expect(validateWithdrawalPayload({ date: validPayload.date, type: "other" })).toEqual({
      error: "A valid amount is required.",
    });
  });
});
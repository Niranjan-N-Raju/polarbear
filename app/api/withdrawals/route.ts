import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import Withdrawal from "@/models/Withdrawal";
import { connectToDatabase } from "@/lib/mongodb";
import { getAuthorizedStoreAdminId, requireAuth } from "@/lib/api-auth";
import { validateCsrf } from "@/lib/csrf";
import { DATE_PATTERN } from "@/lib/date-utils";

interface WithdrawalPayload {
  franchiseId?: string;
  date?: string;
  amount?: number;
  type?: string;
  reason?: string;
}

function validatePayload(body: WithdrawalPayload) {
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

export async function GET(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const auth = authResult;

  const params = new URL(request.url).searchParams;
  const franchiseId = await getAuthorizedStoreAdminId(auth, params.get("franchiseId"));
  if (!franchiseId) {
    return NextResponse.json({ message: "A valid store is required." }, { status: 400 });
  }
  const from = params.get("from");
  const to = params.get("to");
  const hasRange = !!from && !!to && DATE_PATTERN.test(from) && DATE_PATTERN.test(to);

  await connectToDatabase();
  const withdrawals = await Withdrawal.find({
    franchise: franchiseId,
    ...(hasRange ? { date: { $gte: from, $lte: to } } : {}),
  })
    .sort({ date: -1, createdAt: -1 })
    .lean();
  const totals = await Withdrawal.aggregate<{ _id: string; total: number }>([
    {
      $match: {
        franchise: new mongoose.Types.ObjectId(franchiseId),
        type: { $in: ["withdrawal", "repayment"] },
      },
    },
    { $group: { _id: "$type", total: { $sum: "$amount" } } },
  ]);
  const withdrawalTotal = totals.find((item) => item._id === "withdrawal")?.total ?? 0;
  const repaymentTotal = totals.find((item) => item._id === "repayment")?.total ?? 0;

  return NextResponse.json({
    totalWithdrawals: withdrawalTotal,
    totalRepayments: repaymentTotal,
    withdrawals: withdrawals.map((item) => ({
      id: String(item._id),
      date: item.date,
      amount: item.amount,
      type: item.type,
      reason: item.reason ?? "",
    })),
  });
}

export async function POST(request: NextRequest) {
  const csrfError = validateCsrf(request);
  if (csrfError) return csrfError;

  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const auth = authResult;

  const body = (await request.json()) as WithdrawalPayload;
  const franchiseId = await getAuthorizedStoreAdminId(auth, body.franchiseId ?? null);
  if (!franchiseId) {
    return NextResponse.json({ message: "A valid store is required." }, { status: 400 });
  }
  const validation = validatePayload(body);
  if ("error" in validation) return NextResponse.json({ message: validation.error }, { status: 400 });

  await connectToDatabase();
  const created = await Withdrawal.create({
    franchise: franchiseId,
    ...validation.value,
    createdBy: new mongoose.Types.ObjectId(auth.id),
  });

  return NextResponse.json({
    message: "Entry added successfully.",
    withdrawal: {
      id: String(created._id),
      date: created.date,
      amount: created.amount,
      type: created.type,
      reason: created.reason ?? "",
    },
  });
}

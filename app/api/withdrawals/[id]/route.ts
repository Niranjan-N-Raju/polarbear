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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const csrfError = validateCsrf(request);
  if (csrfError) return csrfError;

  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const auth = authResult;

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ message: "A valid entry id is required." }, { status: 400 });
  }

  const body = (await request.json()) as WithdrawalPayload;
  const franchiseId = await getAuthorizedStoreAdminId(auth, body.franchiseId ?? null);
  if (!franchiseId) {
    return NextResponse.json({ message: "A valid store is required." }, { status: 400 });
  }
  const validation = validatePayload(body);
  if ("error" in validation) return NextResponse.json({ message: validation.error }, { status: 400 });

  await connectToDatabase();
  const updated = await Withdrawal.findOneAndUpdate(
    { _id: id, franchise: franchiseId },
    { $set: validation.value },
    { new: true },
  ).lean();
  if (!updated) {
    return NextResponse.json({ message: "Entry not found." }, { status: 404 });
  }

  return NextResponse.json({
    message: "Entry updated successfully.",
    withdrawal: {
      id: String(updated._id),
      date: updated.date,
      amount: updated.amount,
      type: updated.type,
      reason: updated.reason ?? "",
    },
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const csrfError = validateCsrf(request);
  if (csrfError) return csrfError;

  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const auth = authResult;

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ message: "A valid entry id is required." }, { status: 400 });
  }

  const franchiseId = await getAuthorizedStoreAdminId(auth, new URL(request.url).searchParams.get("franchiseId"));
  if (!franchiseId) {
    return NextResponse.json({ message: "A valid store is required." }, { status: 400 });
  }

  await connectToDatabase();
  const deleted = await Withdrawal.findOneAndDelete({ _id: id, franchise: franchiseId }).lean();
  if (!deleted) {
    return NextResponse.json({ message: "Entry not found." }, { status: 404 });
  }

  return NextResponse.json({ message: "Entry removed." });
}

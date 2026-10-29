import mongoose from "mongoose";
import { readJsonObject } from "@/lib/request-json";
import { NextRequest, NextResponse } from "next/server";
import Incentive from "@/models/Incentive";
import { connectToDatabase } from "@/lib/mongodb";
import { validateCsrf } from "@/lib/csrf";
import { getAuthorizedStoreAdminId, requireAuth } from "@/lib/api-auth";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const csrfError = validateCsrf(request);
  if (csrfError) return csrfError;

  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ message: "A valid incentive id is required." }, { status: 400 });
  }

  const jsonBody = await readJsonObject<{ type?: string; amount?: number; paidEarly?: boolean }>(request);
  if (jsonBody.response) return jsonBody.response;
  const body = jsonBody.body;
  const type = (body.type ?? "").trim();
  const amount = Number(body.amount);
  if (!type) {
    return NextResponse.json({ message: "A valid type is required." }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount < 0) {
    return NextResponse.json({ message: "A valid amount is required." }, { status: 400 });
  }
  if (body.paidEarly !== undefined && typeof body.paidEarly !== "boolean") {
    return NextResponse.json({ message: "Paid early must be true or false." }, { status: 400 });
  }

  await connectToDatabase();
  const incentive = await Incentive.findById(id);
  if (!incentive) {
    return NextResponse.json({ message: "Incentive not found." }, { status: 404 });
  }
  if (!(await getAuthorizedStoreAdminId(auth, String(incentive.franchise)))) {
    return NextResponse.json({ message: "Access denied." }, { status: 403 });
  }

  incentive.type = type;
  incentive.amount = amount;
  if (body.paidEarly !== undefined) incentive.paidEarly = body.paidEarly;
  await incentive.save();
  return NextResponse.json({ message: "Incentive updated.", id: String(incentive._id), type, amount, paidEarly: incentive.paidEarly === true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const csrfError = validateCsrf(request);
  if (csrfError) return csrfError;

  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ message: "A valid incentive id is required." }, { status: 400 });
  }

  await connectToDatabase();
  const incentive = await Incentive.findById(id).lean();
  if (!incentive) {
    return NextResponse.json({ message: "Incentive not found." }, { status: 404 });
  }
  if (!(await getAuthorizedStoreAdminId(auth, String(incentive.franchise)))) {
    return NextResponse.json({ message: "Access denied." }, { status: 403 });
  }

  await Incentive.findByIdAndDelete(id);
  return NextResponse.json({ message: "Incentive removed." });
}

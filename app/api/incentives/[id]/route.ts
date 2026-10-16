import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import Incentive from "@/models/Incentive";
import { getAuthInfo } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { validateCsrf } from "@/lib/csrf";
import { getAuthorizedStoreAdminId } from "@/lib/api-auth";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const csrfError = validateCsrf(request);
  if (csrfError) return csrfError;

  const auth = await getAuthInfo();
  if (!auth) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ message: "A valid incentive id is required." }, { status: 400 });
  }

  const body = (await request.json()) as { type?: string; amount?: number };
  const type = (body.type ?? "").trim();
  const amount = Number(body.amount);
  if (!type) {
    return NextResponse.json({ message: "A valid type is required." }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount < 0) {
    return NextResponse.json({ message: "A valid amount is required." }, { status: 400 });
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
  await incentive.save();
  return NextResponse.json({ message: "Incentive updated.", id: String(incentive._id), type, amount });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const csrfError = validateCsrf(request);
  if (csrfError) return csrfError;

  const auth = await getAuthInfo();
  if (!auth) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

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

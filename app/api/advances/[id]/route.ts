import mongoose from "mongoose";
import { readJsonObject } from "@/lib/request-json";
import { NextRequest, NextResponse } from "next/server";
import Advance from "@/models/Advance";
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
    return NextResponse.json({ message: "A valid advance id is required." }, { status: 400 });
  }

  const jsonBody = await readJsonObject<{ type?: string; amount?: number }>(request);
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

  await connectToDatabase();
  const advance = await Advance.findById(id);
  if (!advance) {
    return NextResponse.json({ message: "Advance not found." }, { status: 404 });
  }
  if (!(await getAuthorizedStoreAdminId(auth, String(advance.franchise)))) {
    return NextResponse.json({ message: "Access denied." }, { status: 403 });
  }

  advance.type = type;
  advance.amount = amount;
  await advance.save();
  return NextResponse.json({ message: "Advance updated.", id: String(advance._id), type, amount });
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
    return NextResponse.json({ message: "A valid advance id is required." }, { status: 400 });
  }

  await connectToDatabase();
  const advance = await Advance.findById(id).lean();
  if (!advance) {
    return NextResponse.json({ message: "Advance not found." }, { status: 404 });
  }
  if (!(await getAuthorizedStoreAdminId(auth, String(advance.franchise)))) {
    return NextResponse.json({ message: "Access denied." }, { status: 403 });
  }

  await Advance.findByIdAndDelete(id);
  return NextResponse.json({ message: "Advance removed." });
}

import mongoose from "mongoose";
import { readJsonObject } from "@/lib/request-json";
import { NextRequest, NextResponse } from "next/server";
import ExtraDay from "@/models/ExtraDay";
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
    return NextResponse.json({ message: "A valid extra day id is required." }, { status: 400 });
  }

  const jsonBody = await readJsonObject<{ type?: string; days?: number }>(request);
  if (jsonBody.response) return jsonBody.response;
  const body = jsonBody.body;
  const type = (body.type ?? "").trim();
  const days = Number(body.days);
  if (!type) {
    return NextResponse.json({ message: "A valid type is required." }, { status: 400 });
  }
  if (!Number.isFinite(days) || days < 0) {
    return NextResponse.json({ message: "A valid number of days is required." }, { status: 400 });
  }

  await connectToDatabase();
  const extraDay = await ExtraDay.findById(id);
  if (!extraDay) {
    return NextResponse.json({ message: "Extra days entry not found." }, { status: 404 });
  }
  if (!(await getAuthorizedStoreAdminId(auth, String(extraDay.franchise)))) {
    return NextResponse.json({ message: "Access denied." }, { status: 403 });
  }

  extraDay.type = type;
  extraDay.days = days;
  await extraDay.save();
  return NextResponse.json({ message: "Extra days updated.", id: String(extraDay._id), type, days });
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
    return NextResponse.json({ message: "A valid extra day id is required." }, { status: 400 });
  }

  await connectToDatabase();
  const extraDay = await ExtraDay.findById(id).lean();
  if (!extraDay) {
    return NextResponse.json({ message: "Extra days entry not found." }, { status: 404 });
  }
  if (!(await getAuthorizedStoreAdminId(auth, String(extraDay.franchise)))) {
    return NextResponse.json({ message: "Access denied." }, { status: 403 });
  }

  await ExtraDay.findByIdAndDelete(id);
  return NextResponse.json({ message: "Extra days removed." });
}

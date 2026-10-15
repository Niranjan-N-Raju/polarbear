import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import ExtraDay from "@/models/ExtraDay";
import { getAuthInfo } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { validateCsrf } from "@/lib/csrf";
import { getAllowedFranchiseIdsForCaller } from "@/lib/user-permissions";

async function authorizeStore(authId: string, role: string, franchiseId: string) {
  if (role !== "franchise_admin" || !mongoose.isValidObjectId(franchiseId)) {
    return false;
  }
  const allowedIds = await getAllowedFranchiseIdsForCaller({ id: authId, role });
  return allowedIds?.includes(franchiseId) ?? false;
}

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
    return NextResponse.json({ message: "A valid extra day id is required." }, { status: 400 });
  }

  const body = (await request.json()) as { type?: string; days?: number };
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
  if (!(await authorizeStore(auth.id, auth.role, String(extraDay.franchise)))) {
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

  const auth = await getAuthInfo();
  if (!auth) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ message: "A valid extra day id is required." }, { status: 400 });
  }

  await connectToDatabase();
  const extraDay = await ExtraDay.findById(id).lean();
  if (!extraDay) {
    return NextResponse.json({ message: "Extra days entry not found." }, { status: 404 });
  }
  if (!(await authorizeStore(auth.id, auth.role, String(extraDay.franchise)))) {
    return NextResponse.json({ message: "Access denied." }, { status: 403 });
  }

  await ExtraDay.findByIdAndDelete(id);
  return NextResponse.json({ message: "Extra days removed." });
}

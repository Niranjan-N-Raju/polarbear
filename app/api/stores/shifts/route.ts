import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import Franchise from "@/models/Franchise";
import WeeklyRoster from "@/models/WeeklyRoster";
import { connectToDatabase } from "@/lib/mongodb";
import { getAuthorizedStoreId, requireAuth } from "@/lib/api-auth";
import { validateCsrf } from "@/lib/csrf";

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const SHIFT_ID_PATTERN = /^[A-Za-z0-9_-]{1,80}$/;

export async function GET(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const params = new URL(request.url).searchParams;
  const franchiseId = await getAuthorizedStoreId(authResult, params.get("franchiseId"));
  if (!franchiseId) return NextResponse.json({ message: "A valid store is required." }, { status: 400 });

  await connectToDatabase();
  const store = await Franchise.findById(franchiseId).select("shifts").lean();
  if (!store) return NextResponse.json({ message: "Store not found." }, { status: 404 });
  return NextResponse.json({ shifts: store.shifts ?? [] });
}

export async function PUT(request: NextRequest) {
  const csrfError = validateCsrf(request);
  if (csrfError) return csrfError;

  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  if (!["admin", "sub_admin", "franchise_admin"].includes(authResult.role)) {
    return NextResponse.json({ message: "You are not allowed to configure shifts." }, { status: 403 });
  }

  const body = (await request.json()) as {
    franchiseId?: string;
    shifts?: Array<{ id?: string; name?: string; startTime?: string; endTime?: string }>;
  };
  const franchiseId = await getAuthorizedStoreId(authResult, body.franchiseId);
  if (!franchiseId || !Array.isArray(body.shifts) || body.shifts.length > 20) {
    return NextResponse.json({ message: "A valid store and up to 20 shifts are required." }, { status: 400 });
  }

  const shifts = body.shifts.map((shift) => ({
    id: shift.id?.trim() ?? "",
    name: shift.name?.trim() ?? "",
    startTime: shift.startTime ?? "",
    endTime: shift.endTime ?? "",
  }));
  if (shifts.some((shift) =>
    !SHIFT_ID_PATTERN.test(shift.id) ||
    !shift.name ||
    shift.name.length > 40 ||
    !TIME_PATTERN.test(shift.startTime) ||
    !TIME_PATTERN.test(shift.endTime)
  )) {
    return NextResponse.json({ message: "Each shift needs a name and valid start/end times." }, { status: 400 });
  }
  if (new Set(shifts.map((shift) => shift.id)).size !== shifts.length) {
    return NextResponse.json({ message: "Shift IDs must be unique." }, { status: 400 });
  }
  if (new Set(shifts.map((shift) => shift.name.toLowerCase())).size !== shifts.length) {
    return NextResponse.json({ message: "Shift names must be unique for this store." }, { status: 400 });
  }

  await connectToDatabase();
  if (!mongoose.isValidObjectId(authResult.id)) {
    return NextResponse.json({ message: "A valid authenticated user is required." }, { status: 400 });
  }
  const store = await Franchise.findById(franchiseId).select("shifts");
  if (!store) return NextResponse.json({ message: "Store not found." }, { status: 404 });

  const nextIds = new Set(shifts.map((shift) => shift.id));
  const removedIds = (store.shifts ?? []).map((shift) => shift.id).filter((id) => !nextIds.has(id));
  if (removedIds.length > 0) {
    const usedRoster = await WeeklyRoster.exists({
      franchise: franchiseId,
      "entries.days.shift": { $in: removedIds },
    });
    if (usedRoster) {
      return NextResponse.json({ message: "A shift is used in a saved weekly roster. Change those rosters before removing it." }, { status: 409 });
    }
  }

  store.shifts = shifts;
  await store.save();
  return NextResponse.json({ message: "Store shifts saved.", shifts: store.shifts });
}
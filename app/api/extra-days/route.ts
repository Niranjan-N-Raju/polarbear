import mongoose from "mongoose";
import { readJsonObject } from "@/lib/request-json";
import { NextRequest, NextResponse } from "next/server";
import ExtraDay from "@/models/ExtraDay";
import User from "@/models/User";
import { connectToDatabase } from "@/lib/mongodb";
import { validateCsrf } from "@/lib/csrf";
import { getAuthorizedStoreAdminId, requireAuth } from "@/lib/api-auth";

const PERIOD_PATTERN = /^\d{4}-\d{2}$/;

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const params = new URL(request.url).searchParams;
  const franchiseId = params.get("franchiseId") ?? "";
  const period = params.get("period") ?? "";
  if (!PERIOD_PATTERN.test(period)) {
    return NextResponse.json({ message: "A valid period is required." }, { status: 400 });
  }

  await connectToDatabase();
  if (!(await getAuthorizedStoreAdminId(auth, franchiseId))) {
    return NextResponse.json({ message: "Access denied." }, { status: 403 });
  }

  const extraDays = await ExtraDay.find({ franchise: franchiseId, period }).lean();
  return NextResponse.json({
    extraDays: extraDays.map((extraDay) => ({
      id: String(extraDay._id),
      employeeId: String(extraDay.employee),
      type: extraDay.type,
      days: extraDay.days,
    })),
  });
}

export async function POST(request: NextRequest) {
  const csrfError = validateCsrf(request);
  if (csrfError) return csrfError;

  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const jsonBody = await readJsonObject<{
    franchiseId?: string;
    employeeId?: string;
    period?: string;
    type?: string;
    days?: number;
  }>(request);
  if (jsonBody.response) return jsonBody.response;
  const body = jsonBody.body;
  const franchiseId = body.franchiseId ?? "";
  if (!(await getAuthorizedStoreAdminId(auth, franchiseId))) {
    return NextResponse.json({ message: "Access denied." }, { status: 403 });
  }
  if (!body.employeeId || !mongoose.isValidObjectId(body.employeeId)) {
    return NextResponse.json({ message: "A valid employee is required." }, { status: 400 });
  }
  if (!body.period || !PERIOD_PATTERN.test(body.period)) {
    return NextResponse.json({ message: "A valid period is required." }, { status: 400 });
  }
  const type = body.type?.trim() ?? "";
  if (!type || type.length > 100) {
    return NextResponse.json({ message: "Enter a reason for the extra days." }, { status: 400 });
  }
  if (typeof body.days !== "number" || !Number.isFinite(body.days) || body.days < 0) {
    return NextResponse.json({ message: "Enter a valid number of days." }, { status: 400 });
  }

  await connectToDatabase();
  const employee = await User.findOne({
    _id: body.employeeId,
    role: "employee",
    franchises: franchiseId,
  })
    .select("_id")
    .lean();
  if (!employee) {
    return NextResponse.json({ message: "Employee not found in this store." }, { status: 404 });
  }

  const extraDay = await ExtraDay.create({
    franchise: franchiseId,
    employee: body.employeeId,
    period: body.period,
    type,
    days: body.days,
    createdBy: auth.id,
  });

  return NextResponse.json({
    message: "Extra days added successfully.",
    extraDay: {
      id: String(extraDay._id),
      employeeId: String(extraDay.employee),
      type: extraDay.type,
      days: extraDay.days,
    },
  });
}

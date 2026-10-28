import mongoose from "mongoose";
import { readJsonObject } from "@/lib/request-json";
import { NextRequest, NextResponse } from "next/server";
import Advance from "@/models/Advance";
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

  const advances = await Advance.find({ franchise: franchiseId, period }).lean();
  return NextResponse.json({
    advances: advances.map((advance) => ({
      id: String(advance._id),
      employeeId: String(advance.employee),
      type: advance.type,
      amount: advance.amount,
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
    amount?: number;
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
    return NextResponse.json({ message: "Enter a reason for the advance." }, { status: 400 });
  }
  if (typeof body.amount !== "number" || !Number.isFinite(body.amount) || body.amount < 0) {
    return NextResponse.json({ message: "Enter a valid amount." }, { status: 400 });
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

  const advance = await Advance.create({
    franchise: franchiseId,
    employee: body.employeeId,
    period: body.period,
    type,
    amount: body.amount,
    createdBy: auth.id,
  });

  return NextResponse.json({
    message: "Advance added successfully.",
    advance: {
      id: String(advance._id),
      employeeId: String(advance.employee),
      type: advance.type,
      amount: advance.amount,
    },
  });
}

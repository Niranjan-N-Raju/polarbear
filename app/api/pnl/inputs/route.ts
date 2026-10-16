import { NextRequest, NextResponse } from "next/server";
import Franchise from "@/models/Franchise";
import PnlInput from "@/models/PnlInput";
import { getAuthInfo } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { validateCsrf } from "@/lib/csrf";
import { getAuthorizedStoreAdminId } from "@/lib/api-auth";
import { isValidPeriod } from "@/lib/salary-cycle";

const MAX_FIELDS = 200;
const FIELD_KEY_PATTERN = /^[a-zA-Z][a-zA-Z0-9]{0,49}$/;

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function toPlainValues(values: unknown): Record<string, number> {
  if (values instanceof Map) return Object.fromEntries(values);
  return (values as Record<string, number> | undefined) ?? {};
}

export async function GET(request: NextRequest) {
  const auth = await getAuthInfo();
  if (!auth) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const franchiseId = params.get("franchiseId") ?? "";
  const period = params.get("period") ?? "";
  if (!isValidPeriod(period)) {
    return NextResponse.json({ message: "A valid period is required." }, { status: 400 });
  }

  await connectToDatabase();
  if (!(await getAuthorizedStoreAdminId(auth, franchiseId))) {
    return NextResponse.json({ message: "Access denied." }, { status: 403 });
  }

  const input = await PnlInput.findOne({ franchise: franchiseId, period }).lean();

  return NextResponse.json({
    input: input ? { period: input.period, values: toPlainValues(input.values) } : null,
  });
}

export async function PUT(request: NextRequest) {
  const csrfError = validateCsrf(request);
  if (csrfError) return csrfError;

  const auth = await getAuthInfo();
  if (!auth) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as {
    franchiseId?: string;
    period?: string;
    values?: Record<string, number>;
  };
  const franchiseId = body.franchiseId ?? "";
  const period = body.period ?? "";
  if (!isValidPeriod(period)) {
    return NextResponse.json({ message: "A valid period is required." }, { status: 400 });
  }

  const entries = Object.entries(body.values ?? {});
  if (entries.length > MAX_FIELDS) {
    return NextResponse.json({ message: "Too many fields." }, { status: 400 });
  }
  const values: Record<string, number> = {};
  for (const [key, value] of entries) {
    if (!FIELD_KEY_PATTERN.test(key)) {
      return NextResponse.json({ message: `Invalid field name: ${key}.` }, { status: 400 });
    }
    if (!isFiniteNonNegative(value)) {
      return NextResponse.json({ message: `Enter a valid value for ${key}.` }, { status: 400 });
    }
    values[key] = value;
  }

  await connectToDatabase();
  if (!(await getAuthorizedStoreAdminId(auth, franchiseId))) {
    return NextResponse.json({ message: "Access denied." }, { status: 403 });
  }
  if (!(await Franchise.exists({ _id: franchiseId }))) {
    return NextResponse.json({ message: "Store not found." }, { status: 404 });
  }

  const input = await PnlInput.findOneAndUpdate(
    { franchise: franchiseId, period },
    { $set: { values }, $setOnInsert: { createdBy: auth.id } },
    { new: true, upsert: true, runValidators: true },
  ).lean();

  return NextResponse.json({
    message: "P&L inputs saved.",
    input: { period: input.period, values: toPlainValues(input.values) },
  });
}

import { NextRequest, NextResponse } from "next/server";
import { readJsonObject } from "@/lib/request-json";
import Sale from "@/models/Sale";
import { connectToDatabase } from "@/lib/mongodb";
import { getAuthorizedStoreAdminId, requireAuth } from "@/lib/api-auth";
import { validateCsrf } from "@/lib/csrf";
import { DATE_PATTERN } from "@/lib/date-utils";
import { validateSalePayload } from "@/lib/sales/validation";

interface SaleExpenseInput {
  name?: string;
  amount?: number;
}

interface SalePayload {
  franchiseId?: string;
  date?: string;
  totalSale?: number;
  swiggy?: number;
  zomato?: number;
  upi?: number;
  upiCharge?: number;
  expenses?: SaleExpenseInput[];
}

export async function GET(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const auth = authResult;

  const params = new URL(request.url).searchParams;
  const franchiseId = await getAuthorizedStoreAdminId(auth, params.get("franchiseId"));
  if (!franchiseId) {
    return NextResponse.json({ message: "A valid store is required." }, { status: 400 });
  }
  const from = params.get("from");
  const to = params.get("to");
  const hasRange = !!from && !!to && DATE_PATTERN.test(from) && DATE_PATTERN.test(to);

  await connectToDatabase();
  const sales = await Sale.find({
    franchise: franchiseId,
    ...(hasRange ? { date: { $gte: from, $lte: to } } : {}),
  })
    .sort({ date: -1 })
    .lean();
  return NextResponse.json({
    sales: sales.map((sale) => ({
      id: String(sale._id),
      date: sale.date,
      totalSale: sale.totalSale,
      swiggy: sale.swiggy,
      zomato: sale.zomato,
      upi: sale.upi,
      upiCharge: sale.upiCharge,
      cash: sale.cash,
      expenses: sale.expenses,
      totalExpenses: sale.totalExpenses,
      bankingCash: sale.bankingCash,
    })),
  });
}

export async function POST(request: NextRequest) {
  const csrfError = validateCsrf(request);
  if (csrfError) return csrfError;

  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const auth = authResult;

  const jsonBody = await readJsonObject<SalePayload>(request);
  if (jsonBody.response) return jsonBody.response;
  const body = jsonBody.body;
  const franchiseId = await getAuthorizedStoreAdminId(auth, body.franchiseId ?? null);
  if (!franchiseId) {
    return NextResponse.json({ message: "A valid store is required." }, { status: 400 });
  }
  const validation = validateSalePayload(body);
  if ("error" in validation) return NextResponse.json({ message: validation.error }, { status: 400 });
  const { date, totalSale, swiggy, zomato, upi, upiCharge, expenses } = validation.value;
  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const cash = totalSale - swiggy - zomato - upi;
  const bankingCash = cash - totalExpenses;

  await connectToDatabase();
  const existing = await Sale.findOne({ franchise: franchiseId, date }).select("_id").lean();
  if (existing) {
    return NextResponse.json(
      { message: "A sale already exists for this date. Edit the existing entry instead." },
      { status: 409 },
    );
  }

  try {
    const sale = await Sale.create({
      franchise: franchiseId,
      date,
      totalSale,
      swiggy,
      zomato,
      upi,
      upiCharge,
      cash,
      expenses,
      totalExpenses,
      bankingCash,
      createdBy: auth.id,
    });
    return NextResponse.json({ message: "Sale saved successfully.", id: String(sale._id) });
  } catch (createError) {
    if (createError instanceof Error && "code" in createError && createError.code === 11000) {
      return NextResponse.json(
        { message: "A sale already exists for this date. Edit the existing entry instead." },
        { status: 409 },
      );
    }
    throw createError;
  }
}

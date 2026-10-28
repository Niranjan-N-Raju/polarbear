import { NextRequest, NextResponse } from "next/server";
import { readJsonObject } from "@/lib/request-json";
import mongoose from "mongoose";
import Sale from "@/models/Sale";
import { connectToDatabase } from "@/lib/mongodb";
import { getAuthorizedStoreAdminId, requireAuth } from "@/lib/api-auth";
import { validateCsrf } from "@/lib/csrf";
import { validateSalePayload } from "@/lib/sales/validation";
import type { SalePayload } from "@/types/sales-api";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const csrfError = validateCsrf(request);
  if (csrfError) return csrfError;

  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const auth = authResult;

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ message: "A valid sale id is required." }, { status: 400 });
  }

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

  await connectToDatabase();
  const existingSale = await Sale.findOne({ _id: id, franchise: franchiseId });
  if (!existingSale) {
    return NextResponse.json({ message: "Sale not found." }, { status: 404 });
  }

  const duplicate = await Sale.findOne({
    franchise: franchiseId,
    date,
    _id: { $ne: id },
  })
    .select("_id")
    .lean();
  if (duplicate) {
    return NextResponse.json(
      { message: "A sale already exists for this date." },
      { status: 409 },
    );
  }

  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const cash = totalSale - swiggy - zomato - upi;
  const bankingCash = cash - totalExpenses;

  existingSale.date = date;
  existingSale.totalSale = totalSale;
  existingSale.swiggy = swiggy;
  existingSale.zomato = zomato;
  existingSale.upi = upi;
  existingSale.upiCharge = upiCharge;
  existingSale.cash = cash;
  existingSale.expenses = expenses;
  existingSale.totalExpenses = totalExpenses;
  existingSale.bankingCash = bankingCash;

  try {
    await existingSale.save();
  } catch (saveError) {
    if (saveError instanceof Error && "code" in saveError && saveError.code === 11000) {
      return NextResponse.json(
        { message: "A sale already exists for this date." },
        { status: 409 },
      );
    }
    throw saveError;
  }

  return NextResponse.json({ message: "Sale updated successfully." });
}

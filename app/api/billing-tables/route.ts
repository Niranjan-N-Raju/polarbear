import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_TABLES } from "@/lib/billing";
import { getBillingDatabase, getBillingStoreAccess } from "@/lib/billing-server";
import { validateCsrf } from "@/lib/csrf";
import { readJsonObject } from "@/lib/request-json";

export async function GET(request: NextRequest) {
  const access = await getBillingStoreAccess(request);
  if ("response" in access) return access.response;
  const db = await getBillingDatabase();
  const configured = await db.collection("billing_tables").find({ storeId: access.storeId }).toArray();
  const tables = [...new Set([...DEFAULT_TABLES, ...configured.map((table) => table.tableNumber as string)])]
    .sort((left, right) => Number(left.slice(1)) - Number(right.slice(1)));
  return NextResponse.json({ tables });
}

export async function POST(request: NextRequest) {
  const csrfError = validateCsrf(request);
  if (csrfError) return csrfError;
  const access = await getBillingStoreAccess(request);
  if ("response" in access) return access.response;
  const json = await readJsonObject<{ tableNumber?: unknown }>(request, 2000);
  if (json.response) return json.response;
  const tableNumber = typeof json.body.tableNumber === "string" ? json.body.tableNumber.trim().toUpperCase() : "";
  if (!/^T[1-9]\d{0,3}$/.test(tableNumber)) {
    return NextResponse.json({ message: "Enter a table number from T1 to T9999." }, { status: 400 });
  }
  if (DEFAULT_TABLES.includes(tableNumber)) {
    return NextResponse.json({ message: "That table already exists." }, { status: 409 });
  }
  const db = await getBillingDatabase();
  try {
    await db.collection("billing_tables").insertOne({
      storeId: access.storeId, tableNumber, createdBy: access.auth.id, createdAt: new Date(),
    });
    return NextResponse.json({ tableNumber }, { status: 201 });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      return NextResponse.json({ message: "That table already exists." }, { status: 409 });
    }
    throw error;
  }
}
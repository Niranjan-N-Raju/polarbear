import { ObjectId, type Document, type Filter } from "mongodb";
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { billTotals, DEFAULT_TABLES, pricePaise, type BillCustomer } from "@/lib/billing";
import { getBillingDatabase, getBillingStoreAccess, serializeBill } from "@/lib/billing-server";
import { encrypt } from "@/lib/crypto";
import { validateCsrf } from "@/lib/csrf";
import { readJsonObject } from "@/lib/request-json";
import { businessDateValue, isValidDate } from "@/lib/date-utils";

export async function GET(request: NextRequest) {
  const access = await getBillingStoreAccess(request);
  if ("response" in access) return access.response;
  if (request.nextUrl.searchParams.get("newRequest") === "true") return NextResponse.json({ requestId: randomUUID() });
  const db = await getBillingDatabase();
  const billId = request.nextUrl.searchParams.get("billId");
  if (billId !== null) {
    if (!ObjectId.isValid(billId)) return NextResponse.json({ message: "Invalid bill." }, { status: 400 });
    const bill = await db.collection("bills").findOne({ _id: new ObjectId(billId), storeId: access.storeId });
    return bill ? NextResponse.json({ bill: serializeBill(bill) }) : NextResponse.json({ message: "Bill not found." }, { status: 404 });
  }
  if (request.nextUrl.searchParams.get("view") === "history") {
    const params = request.nextUrl.searchParams;
    const today = businessDateValue();
    const from = params.get("from") ?? today;
    const to = params.get("to") ?? today;
    const orderType = params.get("orderType") ?? "";
    const tableNumber = params.get("tableNumber") ?? "";
    const search = (params.get("search") ?? "").trim();
    const pageValue = params.get("page") ?? "1";
    const page = Number(pageValue);
    if (!isValidDate(from) || !isValidDate(to) || from > to ||
        !/^\d+$/.test(pageValue) || !Number.isSafeInteger(page) || page < 1 || page > 10000 ||
        (orderType !== "" && orderType !== "dineIn" && orderType !== "takeAway") ||
        (tableNumber !== "" && !/^T[1-9]\d{0,3}$/.test(tableNumber)) || search.length > 80) {
      return NextResponse.json({ message: "Choose a valid date range and billing filters." }, { status: 400 });
    }
    const end = new Date(`${to}T00:00:00+05:30`);
    end.setTime(end.getTime() + 86_400_000);
    const filter: Filter<Document> = {
      storeId: access.storeId,
      createdAt: { $gte: new Date(`${from}T00:00:00+05:30`), $lt: end },
      ...(orderType ? { orderType } : {}),
      ...(tableNumber ? { tableNumber } : {}),
      ...(search ? { billNumber: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } } : {}),
    };
    const pageSize = 25;
    const [bills, total, tables] = await Promise.all([
      db.collection("bills").find(filter, { projection: { billNumber: 1, orderType: 1, tableNumber: 1, totalPaise: 1, createdAt: 1 } })
        .sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).toArray(),
      db.collection("bills").countDocuments(filter),
      db.collection("billing_tables").find({ storeId: access.storeId }).toArray(),
    ]);
    return NextResponse.json({
      storeName: access.storeName, bills: bills.map((bill) => ({ ...bill, _id: String(bill._id) })),
      tables: [...new Set([...DEFAULT_TABLES, ...tables.map((table) => table.tableNumber as string)])].sort((left, right) => Number(left.slice(1)) - Number(right.slice(1))),
      page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  }
  const [products, categories, tables] = await Promise.all([
    db.collection("menu_products").find({}).sort({ name: 1 }).toArray(),
    db.collection("product_categories").find({}).toArray(),
    db.collection("billing_tables").find({ storeId: access.storeId }).toArray(),
  ]);
  const categoryNames = new Map(categories.map((category) => [String(category._id), category.name]));
  return NextResponse.json({
    storeName: access.storeName,
    products: products.map((product) => ({
      _id: String(product._id), name: product.name,
      category: categoryNames.get(String(product.categoryId)) ?? "Uncategorized",
      price: pricePaise(product.price) === null ? null : product.price,
    })),
    tables: [...new Set([...DEFAULT_TABLES, ...tables.map((table) => table.tableNumber as string)])].sort((left, right) => Number(left.slice(1)) - Number(right.slice(1))),
  });
}

export async function POST(request: NextRequest) {
  const csrfError = validateCsrf(request);
  if (csrfError) return csrfError;
  const access = await getBillingStoreAccess(request);
  if ("response" in access) return access.response;
  const json = await readJsonObject<Record<string, unknown>>(request, 50_000);
  if (json.response) return json.response;
  const body = json.body;
  if (typeof body.requestId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.requestId)) {
    return NextResponse.json({ message: "A valid billing request is required." }, { status: 400 });
  }
  const db = await getBillingDatabase();
  const existing = await db.collection("bills").findOne({ storeId: access.storeId, requestId: body.requestId });
  if (existing) return NextResponse.json({ bill: serializeBill(existing) });
  if (body.orderType !== "dineIn" && body.orderType !== "takeAway") {
    return NextResponse.json({ message: "Choose dine-in or takeaway." }, { status: 400 });
  }
  const tableNumber = typeof body.tableNumber === "string" ? body.tableNumber : "";
  if (!/^T[1-9]\d{0,3}$/.test(tableNumber) || (!DEFAULT_TABLES.includes(tableNumber) && !await db.collection("billing_tables").findOne({ storeId: access.storeId, tableNumber }))) {
    return NextResponse.json({ message: "Choose a valid token in this store for dine-in or takeaway." }, { status: 400 });
  }
  if (!Array.isArray(body.items) || !body.items.length || body.items.length > 100) {
    return NextResponse.json({ message: "Choose between 1 and 100 products." }, { status: 400 });
  }
  const requested: { productId: string; quantity: number }[] = [];
  for (const entry of body.items) {
    if (!entry || typeof entry !== "object") return NextResponse.json({ message: "Invalid bill item." }, { status: 400 });
    const { productId, quantity } = entry as Record<string, unknown>;
    if (typeof productId !== "string" || !ObjectId.isValid(productId) || typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
      return NextResponse.json({ message: "Choose valid products and whole quantities from 1 to 999." }, { status: 400 });
    }
    requested.push({ productId: new ObjectId(productId).toHexString(), quantity });
  }
  if (new Set(requested.map((item) => item.productId)).size !== requested.length) {
    return NextResponse.json({ message: "Combine repeated products into a single quantity." }, { status: 400 });
  }
  const products = await db.collection("menu_products").find({ _id: { $in: requested.map((item) => new ObjectId(item.productId)) } }).toArray();
  const items = [];
  for (const item of requested) {
    const product = products.find((candidate) => String(candidate._id) === item.productId);
    const unitPricePaise = pricePaise(product?.price);
    if (!product || unitPricePaise === null) return NextResponse.json({ message: "A selected product is missing or has no price. Refresh the menu." }, { status: 409 });
    items.push({ productId: product._id, name: product.name as string, quantity: item.quantity, unitPricePaise, amountPaise: unitPricePaise * item.quantity });
  }
  const totals = billTotals(items.reduce((sum, item) => sum + item.amountPaise, 0));
  if (!Number.isSafeInteger(totals.totalPaise) || totals.subtotalPaise <= 0 || totals.totalPaise > 100_000_000) {
    return NextResponse.json({ message: "The bill total cannot exceed INR 1,000,000." }, { status: 400 });
  }
  if (body.expectedSubtotalPaise !== totals.subtotalPaise) {
    return NextResponse.json({ message: "Product prices changed. Refresh the menu and review the total before saving." }, { status: 409 });
  }
  let customer: BillCustomer | null = null;
  if (body.customer !== undefined && body.customer !== null) {
    if (typeof body.customer !== "object" || Array.isArray(body.customer)) return NextResponse.json({ message: "Invalid customer details." }, { status: 400 });
    const input = body.customer as Record<string, unknown>;
    const fields = ["mobile", "firstName", "middleName", "lastName"] as const;
    for (const field of fields) {
      if (typeof input[field] !== "string" || (input[field] as string).trim().length > 80) return NextResponse.json({ message: "Customer fields must be text of at most 80 characters." }, { status: 400 });
    }
    const plain = Object.fromEntries(fields.map((field) => [field, (input[field] as string).trim()])) as unknown as BillCustomer;
    if (!/^\d{10}$/.test(plain.mobile) || !plain.firstName) return NextResponse.json({ message: "Enter a 10-digit mobile number and customer first name." }, { status: 400 });
    try {
      customer = { mobile: encrypt(plain.mobile), firstName: encrypt(plain.firstName), middleName: encrypt(plain.middleName), lastName: encrypt(plain.lastName) };
    } catch {
      return NextResponse.json({ message: "Customer details cannot be saved until secure storage is configured." }, { status: 503 });
    }
  }
  const id = new ObjectId();
  const bill = {
    _id: id, billNumber: `B-${id.toHexString().toUpperCase()}`, storeId: access.storeId, storeName: access.storeName,
    requestId: body.requestId, orderType: body.orderType, tableNumber, items, ...totals,
    customer, createdBy: access.auth.id, createdAt: new Date(),
  };
  try {
    await db.collection("bills").insertOne(bill);
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
    const saved = await db.collection("bills").findOne({ storeId: access.storeId, requestId: body.requestId });
    if (!saved) throw error;
    return NextResponse.json({ bill: serializeBill(saved) });
  }
  return NextResponse.json({ bill: serializeBill(bill) }, { status: 201 });
}
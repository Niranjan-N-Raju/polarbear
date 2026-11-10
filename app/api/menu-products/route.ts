import { ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { validateCsrf } from "@/lib/csrf";
import { getInventoryDatabase } from "@/lib/inventory-db";
import { normalizeProductName } from "@/lib/inventory/validation";
import { readJsonObject } from "@/lib/request-json";

async function requireMenuAdmin() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  return auth.role === "admin" ? null : NextResponse.json(
    { message: "Only administrators can manage menu products." }, { status: 403 }
  );
}

function parseComposition(value: unknown): { productId: ObjectId; quantity: number }[] | null {
  if (!Array.isArray(value) || !value.length || value.length > 100) return null;
  const items: { productId: ObjectId; quantity: number }[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") return null;
    const { productId, quantity } = entry as Record<string, unknown>;
    if (typeof productId !== "string" || !ObjectId.isValid(productId) ||
        typeof quantity !== "number" || !Number.isFinite(quantity) || quantity <= 0) return null;
    items.push({ productId: new ObjectId(productId), quantity });
  }
  return new Set(items.map((item) => String(item.productId))).size === items.length ? items : null;
}

export async function GET() {
  const forbidden = await requireMenuAdmin();
  if (forbidden) return forbidden;
  const products = await (await getInventoryDatabase()).collection("menu_products")
    .find({}).sort({ name: 1 }).toArray();
  return NextResponse.json({ products });
}

async function save(request: NextRequest, editing: boolean) {
  const csrfError = validateCsrf(request);
  if (csrfError) return csrfError;
  const forbidden = await requireMenuAdmin();
  if (forbidden) return forbidden;
  const jsonBody = await readJsonObject<Record<string, unknown>>(request);
  if (jsonBody.response) return jsonBody.response;
  const body = jsonBody.body;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const price = body.price;
  if (typeof price !== "number" || !Number.isFinite(price) || price < 0.01 || price > 1_000_000 || Math.abs(price * 100 - Math.round(price * 100)) > 0.000001) {
    return NextResponse.json({ message: "Enter a price between 0.01 and 1,000,000 rupees, with at most two decimal places." }, { status: 400 });
  }
  const categoryId = typeof body.categoryId === "string" ? body.categoryId : "";
  const productId = typeof body.productId === "string" ? body.productId : "";
  const dineIn = parseComposition(body.dineIn);
  const takeAway = parseComposition(body.takeAway);
  if (!name || name.length > 100 || !ObjectId.isValid(categoryId) || !dineIn || !takeAway ||
      (editing && !ObjectId.isValid(productId))) {
    return NextResponse.json({ message: "A category, product name (1 to 100 characters), and both compositions with unique materials and positive quantities are required." }, { status: 400 });
  }
  const db = await getInventoryDatabase();
  if (!await db.collection("product_categories").findOne({ _id: new ObjectId(categoryId) })) {
    return NextResponse.json({ message: "Choose an existing category." }, { status: 400 });
  }
  const materialIds = [...new Set([...dineIn, ...takeAway].map((item) => String(item.productId)))];
  if (await db.collection("products").countDocuments({ _id: { $in: materialIds.map((id) => new ObjectId(id)) } }) !== materialIds.length) {
    return NextResponse.json({ message: "Choose existing raw materials for both compositions." }, { status: 400 });
  }
  const values = { name, normalizedName: normalizeProductName(name), price: Math.round(price * 100) / 100, categoryId: new ObjectId(categoryId), dineIn, takeAway };
  try {
    if (editing) {
      const product = await db.collection("menu_products").findOneAndUpdate(
        { _id: new ObjectId(productId) }, { $set: values }, { returnDocument: "after" }
      );
      return product ? NextResponse.json({ product }) : NextResponse.json({ message: "Product not found." }, { status: 404 });
    }
    const product = { _id: new ObjectId(), ...values, createdAt: new Date() };
    await db.collection("menu_products").insertOne(product);
    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      return NextResponse.json({ message: "That product name already exists." }, { status: 409 });
    }
    throw error;
  }
}

export async function POST(request: NextRequest) { return save(request, false); }
export async function PATCH(request: NextRequest) { return save(request, true); }
import { ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";
import { readJsonObject } from "@/lib/request-json";
import { validateCsrf } from "@/lib/csrf";
import { getInventoryDatabase } from "@/lib/inventory-db";
import { requireAuth } from "@/lib/api-auth";
import { normalizeProductName } from "@/lib/inventory/validation";

async function requireCategoryAdmin() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (auth.role !== "admin") {
    return NextResponse.json(
      { message: "Only administrators can manage product categories." },
      { status: 403 }
    );
  }
  return null;
}

function serializeCategory(category: Record<string, unknown>) {
  return {
    ...category,
    _id: String(category._id),
  };
}

export async function GET() {
  const forbidden = await requireCategoryAdmin();
  if (forbidden) return forbidden;
  const db = await getInventoryDatabase();
  const categories = await db
    .collection("product_categories")
    .find({})
    .sort({ name: 1 })
    .toArray();
  return NextResponse.json({ categories: categories.map(serializeCategory) });
}

export async function POST(request: NextRequest) {
  const csrfError = validateCsrf(request);
  if (csrfError) return csrfError;
  const forbidden = await requireCategoryAdmin();
  if (forbidden) return forbidden;
  const jsonBody = await readJsonObject<{ name?: unknown }>(request);
  if (jsonBody.response) return jsonBody.response;
  const name = typeof jsonBody.body.name === "string" ? jsonBody.body.name.trim() : "";
  if (!name || name.length > 100) {
    return NextResponse.json(
      { message: "Enter a category name of 1 to 100 characters." },
      { status: 400 }
    );
  }
  const category = {
    _id: new ObjectId(),
    name,
    normalizedName: normalizeProductName(name),
    createdAt: new Date(),
  };
  try {
    await (await getInventoryDatabase())
      .collection("product_categories")
      .insertOne(category);
    return NextResponse.json(
      { category: serializeCategory(category) },
      { status: 201 }
    );
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      return NextResponse.json(
        { message: "That category name already exists." },
        { status: 409 }
      );
    }
    throw error;
  }
}

export async function PATCH(request: NextRequest) {
  const csrfError = validateCsrf(request);
  if (csrfError) return csrfError;
  const forbidden = await requireCategoryAdmin();
  if (forbidden) return forbidden;
  const jsonBody = await readJsonObject<{
    categoryId?: string;
    name?: unknown;
  }>(request);
  if (jsonBody.response) return jsonBody.response;
  const { categoryId } = jsonBody.body;
  const name = typeof jsonBody.body.name === "string" ? jsonBody.body.name.trim() : "";
  if (!categoryId || !ObjectId.isValid(categoryId) || !name || name.length > 100) {
    return NextResponse.json(
      { message: "A valid category and name are required." },
      { status: 400 }
    );
  }
  try {
    const db = await getInventoryDatabase();
    const result = await db.collection("product_categories").updateOne(
      { _id: new ObjectId(categoryId) },
      { $set: { name, normalizedName: normalizeProductName(name) } }
    );
    if (!result.matchedCount) {
      return NextResponse.json({ message: "Category not found." }, { status: 404 });
    }
    const category = await db
      .collection("product_categories")
      .findOne({ _id: new ObjectId(categoryId) });
    return NextResponse.json({
      category: category ? serializeCategory(category) : null,
    });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      return NextResponse.json(
        { message: "That category name already exists." },
        { status: 409 }
      );
    }
    throw error;
  }
}
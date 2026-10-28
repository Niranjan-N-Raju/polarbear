import { ObjectId } from "mongodb";
import { readJsonObject } from "@/lib/request-json";
import { NextRequest, NextResponse } from "next/server";
import { validateCsrf } from "@/lib/csrf";
import { getInventoryClient, getInventoryDatabase } from "@/lib/inventory-db";
import { getStoreAccess } from "@/lib/api-auth";
import { normalizeProductName } from "@/lib/inventory/validation";

export async function GET(request: NextRequest) {
  const access = await getStoreAccess(request);
  if ("response" in access) return access.response;
  const db = await getInventoryDatabase();
  const products = await db.collection("products").find({}).sort({ name: 1 }).toArray();
  return NextResponse.json({
    products: products.map((product) => ({
      _id: String(product._id),
      name: product.name,
      normalizedName: product.normalizedName,
      createdAt: product.createdAt,
    })),
  });
}

export async function POST(request: NextRequest) {
  const csrfError = validateCsrf(request);
  if (csrfError) return csrfError;
  const access = await getStoreAccess(request);
  if ("response" in access) return access.response;
  const jsonBody = await readJsonObject<{ name?: unknown }>(request);
  if (jsonBody.response) return jsonBody.response;
  const body = jsonBody.body;
  const names = typeof body.name === "string"
    ? body.name.split(",").map((value) => value.trim()).filter(Boolean)
    : [];
  const normalizedNames = names.map(normalizeProductName);
  if (names.length === 0) {
    return NextResponse.json({ message: "Enter at least one product name." }, { status: 400 });
  }
  if (names.some((name) => name.length > 100)) {
    return NextResponse.json({ message: "Each product name must be 100 characters or fewer." }, { status: 400 });
  }
  if (new Set(normalizedNames).size !== normalizedNames.length) {
    return NextResponse.json({ message: "Product names must be unique." }, { status: 409 });
  }
  const db = await getInventoryDatabase();
  try {
    const products = names.map((name, index) => ({
      _id: new ObjectId(),
      name,
      normalizedName: normalizedNames[index],
      createdAt: new Date(),
    }));
    await db.collection("products").insertMany(products, { ordered: true });
    return NextResponse.json({ products: products.map((product) => ({ ...product, _id: String(product._id) })) }, { status: 201 });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      return NextResponse.json({ message: "A product with this name already exists." }, { status: 409 });
    }
    throw error;
  }
}

export async function PATCH(request: NextRequest) {
  const csrfError = validateCsrf(request);
  if (csrfError) return csrfError;
  const access = await getStoreAccess(request);
  if ("response" in access) return access.response;
  const jsonBody = await readJsonObject<{ productId?: string; name?: unknown }>(request);
  if (jsonBody.response) return jsonBody.response;
  const body = jsonBody.body;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const normalizedName = normalizeProductName(name);
  if (!body.productId || !ObjectId.isValid(body.productId) || !name || name.length > 100) {
    return NextResponse.json({ message: "A valid product and name are required." }, { status: 400 });
  }
  const db = await getInventoryDatabase();
  const client = await getInventoryClient();
  const session = client.startSession();
  try {
    const productId = new ObjectId(body.productId);
    const existing = await db.collection("products").findOne({ _id: productId });
    if (!existing) return NextResponse.json({ message: "Product not found." }, { status: 404 });
    // Product and inventory snapshots are kept in sync as one MongoDB transaction.
    await session.withTransaction(async () => {
        await db.collection("products").updateOne(
          { _id: productId },
          { $set: { name, normalizedName } },
          { session },
        );
        await db.collection("inventory_items").updateMany(
          { productId },
          { $set: { product: name } },
          { session },
        );
    });
    return NextResponse.json({ message: "Product updated." });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      return NextResponse.json({ message: "A product with this name already exists." }, { status: 409 });
    }
    throw error;
  } finally {
    await session?.endSession();
  }
}

export async function DELETE(request: NextRequest) {
  const csrfError = validateCsrf(request);
  if (csrfError) return csrfError;
  const access = await getStoreAccess(request);
  if ("response" in access) return access.response;
  const jsonBody = await readJsonObject<{ productId?: string }>(request);
  if (jsonBody.response) return jsonBody.response;
  const body = jsonBody.body;
  if (!body.productId || !ObjectId.isValid(body.productId)) {
    return NextResponse.json({ message: "A valid product is required." }, { status: 400 });
  }

  const db = await getInventoryDatabase();
  const productId = new ObjectId(body.productId);
  const product = await db.collection("products").findOne({ _id: productId });
  if (!product) return NextResponse.json({ message: "Product not found." }, { status: 404 });

  const [inventoryReferences, dumpedReferences] = await Promise.all([
    db.collection("inventory_items").countDocuments({ productId }),
    db.collection("dumped_inventory").countDocuments({ productId }),
  ]);
  if (inventoryReferences || dumpedReferences) {
    return NextResponse.json(
      { message: "This product has stock or disposal history and cannot be deleted." },
      { status: 409 },
    );
  }

  await db.collection("products").deleteOne({ _id: productId });
  return NextResponse.json({ message: "Product deleted." });
}
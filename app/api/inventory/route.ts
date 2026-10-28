import { ObjectId } from "mongodb";
import { readJsonObject } from "@/lib/request-json";
import { NextRequest, NextResponse } from "next/server";
import { validateCsrf } from "@/lib/csrf";
import { getInventoryClient, getInventoryDatabase } from "@/lib/inventory-db";
import { getStoreAccess } from "@/lib/api-auth";
import { isValidDate, parsePositiveInteger } from "@/lib/inventory/validation";
import { localDateValue } from "@/lib/date-utils";

export async function GET(request: NextRequest) {
  const access = await getStoreAccess(request);
  if ("response" in access) return access.response;
  const db = await getInventoryDatabase();
  const items = await db.collection("inventory_items").find({ storeId: access.storeId, quantity: { $gt: 0 } }).sort({ expiryDate: 1, product: 1 }).toArray();
  return NextResponse.json({
    items: items.map((item) => ({
      _id: String(item._id),
      productId: String(item.productId),
      product: item.product,
      quantity: item.quantity,
      expiryDate: item.expiryDate,
    })),
  });
}

export async function POST(request: NextRequest) {
  const csrfError = validateCsrf(request);
  if (csrfError) return csrfError;
  const access = await getStoreAccess(request);
  if ("response" in access) return access.response;
  const jsonBody = await readJsonObject<{ productId?: string; expiryDate?: string; quantity?: unknown }>(request);
  if (jsonBody.response) return jsonBody.response;
  const body = jsonBody.body;
  const quantity = parsePositiveInteger(body.quantity);
  if (!body.productId || !ObjectId.isValid(body.productId) || !body.expiryDate || !isValidDate(body.expiryDate) || !quantity) {
    return NextResponse.json({ message: "Product, expiry date, and a positive quantity are required." }, { status: 400 });
  }
  const db = await getInventoryDatabase();
  const product = await db.collection("products").findOne({ _id: new ObjectId(body.productId) });
  if (!product) return NextResponse.json({ message: "Choose a predefined product." }, { status: 404 });
  const result = await db.collection("inventory_items").findOneAndUpdate(
    { storeId: access.storeId, productId: product._id, expiryDate: body.expiryDate },
    {
      $set: { product: product.name },
      $setOnInsert: { _id: new ObjectId(), storeId: access.storeId, productId: product._id, expiryDate: body.expiryDate, createdAt: new Date() },
      $inc: { quantity },
    },
    { upsert: true, returnDocument: "after" },
  );
  return NextResponse.json({ item: result }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const csrfError = validateCsrf(request);
  if (csrfError) return csrfError;
  const access = await getStoreAccess(request);
  if ("response" in access) return access.response;
  const jsonBody = await readJsonObject<{ action?: string; inventoryItemId?: string; quantity?: unknown }>(request);
  if (jsonBody.response) return jsonBody.response;
  const body = jsonBody.body;
  if (!body.inventoryItemId || !ObjectId.isValid(body.inventoryItemId)) {
    return NextResponse.json({ message: "A valid inventory item is required." }, { status: 400 });
  }
  const db = await getInventoryDatabase();
  const itemId = new ObjectId(body.inventoryItemId);
  const item = await db.collection("inventory_items").findOne({ _id: itemId, storeId: access.storeId, quantity: { $gt: 0 } });
  if (!item) return NextResponse.json({ message: "Inventory item not found or already empty." }, { status: 404 });

  if (body.action === "consume") {
    const quantity = parsePositiveInteger(body.quantity);
    if (!quantity) return NextResponse.json({ message: "Choose a positive quantity." }, { status: 400 });
    const today = localDateValue();
    if (item.expiryDate < today) return NextResponse.json({ message: "Expired stock cannot be consumed." }, { status: 400 });
    // Enforce first-expiry-first-out so newer stock is not used while older stock remains.
    const earlier = await db.collection("inventory_items").findOne({
      storeId: access.storeId,
      productId: item.productId,
      expiryDate: { $gte: today, $lt: item.expiryDate },
      quantity: { $gt: 0 },
    }, { sort: { expiryDate: 1 } });
    if (earlier) {
      return NextResponse.json({ message: `Use the earlier expiry ${earlier.expiryDate} first.` }, { status: 400 });
    }
    const updated = await db.collection("inventory_items").findOneAndUpdate(
      { _id: itemId, storeId: access.storeId, quantity: { $gte: quantity } },
      { $inc: { quantity: -quantity } },
      { returnDocument: "after" },
    );
    if (!updated) return NextResponse.json({ message: "Not enough stock available." }, { status: 400 });
    return NextResponse.json({ message: "Stock consumed successfully.", item: updated });
  }

  if (body.action === "dump") {
    const today = localDateValue();
    if (item.expiryDate >= today) return NextResponse.json({ message: "Only expired stock can be dumped." }, { status: 400 });
    const client = await getInventoryClient();
    const session = client.startSession();
    try {
      // Keep the stock decrement and disposal record atomic to prevent partial dumps.
      await session.withTransaction(async () => {
        const dumped = await db.collection("inventory_items").findOneAndUpdate(
          { _id: itemId, storeId: access.storeId, quantity: { $gt: 0 }, expiryDate: { $lt: today } },
          { $set: { quantity: 0 } },
          { returnDocument: "after", session },
        );
        if (!dumped) throw new Error("DUMP_RACE");
        await db.collection("dumped_inventory").insertOne({
          inventoryItemId: itemId,
          storeId: access.storeId,
          productId: item.productId,
          product: item.product,
          expiryDate: item.expiryDate,
          quantity: dumped.quantity === 0 ? item.quantity : 0,
          dumpedAt: new Date(),
        }, { session });
      });
    } catch (error) {
      if (error instanceof Error && error.message === "DUMP_RACE") return NextResponse.json({ message: "Stock was already dumped." }, { status: 409 });
      throw error;
    } finally {
      await session.endSession();
    }
    return NextResponse.json({ message: "Expired stock dumped successfully." });
  }

  return NextResponse.json({ message: "Unsupported inventory action." }, { status: 400 });
}
import { ObjectId, type Document } from "mongodb";
import { NextResponse, type NextRequest } from "next/server";
import { getStoreAccess } from "@/lib/api-auth";
import { getInventoryDatabase } from "@/lib/inventory-db";
import { decrypt } from "@/lib/crypto";

const cache = globalThis as typeof globalThis & { billingIndexes?: Promise<void> };

export async function getBillingDatabase() {
  const db = await getInventoryDatabase();
  cache.billingIndexes ??= Promise.all([
    db.collection("bills").createIndex({ storeId: 1, createdAt: -1 }),
    db.collection("bills").createIndex({ storeId: 1, requestId: 1 }, { unique: true }),
    db.collection("bills").createIndex({ billNumber: 1 }, { unique: true }),
    db.collection("billing_tables").createIndex({ storeId: 1, tableNumber: 1 }, { unique: true }),
  ]).then(() => undefined).catch((error: unknown) => {
    cache.billingIndexes = undefined;
    throw error;
  });
  await cache.billingIndexes;
  return db;
}

export async function getBillingStoreAccess(request: NextRequest) {
  const access = await getStoreAccess(request);
  if ("response" in access) return access;
  const db = await getBillingDatabase();
  const store = await db.collection("franchises").findOne({
    _id: new ObjectId(access.storeId), isActive: { $ne: false }, archivedAt: null,
  }, { projection: { name: 1 } });
  if (!store) return { response: NextResponse.json({ message: "This store is no longer available for billing." }, { status: 403 }) };
  return { ...access, storeName: typeof store.name === "string" ? store.name : "Store" };
}

export function serializeBill(bill: Document) {
  return {
    _id: String(bill._id),
    billNumber: bill.billNumber,
    storeName: bill.storeName,
    orderType: bill.orderType,
    tableNumber: bill.tableNumber,
    items: bill.items.map((item: Document) => ({
      productId: String(item.productId), name: item.name, quantity: item.quantity,
      unitPricePaise: item.unitPricePaise, amountPaise: item.amountPaise,
    })),
    subtotalPaise: bill.subtotalPaise,
    gstPercent: bill.gstPercent,
    gstPaise: bill.gstPaise,
    totalPaise: bill.totalPaise,
    customer: bill.customer ? {
      mobile: decrypt(bill.customer.mobile),
      firstName: decrypt(bill.customer.firstName),
      middleName: decrypt(bill.customer.middleName),
      lastName: decrypt(bill.customer.lastName),
    } : null,
    createdAt: bill.createdAt,
  };
}
import {
  MongoClient,
  type Db,
  type MongoClientOptions,
} from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB;

type CachedMongo = {
  client: MongoClient | null;
  promise: Promise<MongoClient> | null;
};

const globalForInventory = globalThis as typeof globalThis & {
  inventoryMongo?: CachedMongo;
};

const cached = (globalForInventory.inventoryMongo ??= {
  client: null,
  promise: null,
});

export async function getInventoryDb(): Promise<Db> {
  if (!uri || !dbName) {
    throw new Error("MONGODB_URI and MONGODB_DB are required for inventory.");
  }

  if (!cached.promise) {
    const options: MongoClientOptions = { maxPoolSize: 10 };
    cached.promise = MongoClient.connect(uri, options);
  }
  cached.client = await cached.promise;
  return cached.client.db(dbName);
}

export async function getInventoryClient(): Promise<MongoClient> {
  if (!uri || !dbName) {
    throw new Error("MONGODB_URI and MONGODB_DB are required for inventory.");
  }
  if (!cached.promise) cached.promise = MongoClient.connect(uri, { maxPoolSize: 10 });
  cached.client = await cached.promise;
  return cached.client;
}

export async function ensureInventoryIndexes(db: Db) {
  await Promise.all([
    db.collection("products").createIndex(
      { normalizedName: 1 },
      { unique: true },
    ),
    db.collection("inventory_items").createIndex(
      { storeId: 1, productId: 1, expiryDate: 1 },
      { unique: true },
    ),
    db.collection("inventory_items").createIndex({ storeId: 1, expiryDate: 1 }),
    db.collection("dumped_inventory").createIndex({ storeId: 1, dumpedAt: -1 }),
  ]);
}

export async function getInventoryDatabase() {
  const db = await getInventoryDb();
  await ensureInventoryIndexes(db);
  return db;
}
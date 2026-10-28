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
  indexes?: Promise<void> | null;
};

const globalForInventory = globalThis as typeof globalThis & {
  inventoryMongo?: CachedMongo;
};

const cached = (globalForInventory.inventoryMongo ??= {
  client: null,
  promise: null,
});

export async function getInventoryClient(): Promise<MongoClient> {
  if (!uri || !dbName) {
    throw new Error("MONGODB_URI and MONGODB_DB are required for inventory.");
  }
  if (!cached.promise) {
    const options: MongoClientOptions = { maxPoolSize: 10 };
    cached.promise = MongoClient.connect(uri, options);
  }
  try {
    cached.client = await cached.promise;
  } catch (error) {
    // Allow the next request to retry after a transient connection failure.
    cached.promise = null;
    throw error;
  }
  return cached.client;
}

export async function getInventoryDb(): Promise<Db> {
  const client = await getInventoryClient();
  return client.db(dbName);
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
  // Index creation runs once per process; a failed attempt is retried on the next call.
  if (!cached.indexes) {
    cached.indexes = ensureInventoryIndexes(db).then(() => undefined, (error) => {
      cached.indexes = null;
      throw error;
    });
  }
  await cached.indexes;
  return db;
}
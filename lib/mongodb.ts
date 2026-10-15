import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI as string;
const MONGODB_DB = process.env.MONGODB_DB as string;

if (!MONGODB_URI) {
  throw new Error(
    "Please define the MONGODB_URI environment variable in .env.local",
  );
}
if (!MONGODB_DB) {
  throw new Error(
    "Please define the MONGODB_DB environment variable in .env.local",
  );
}

// Cached connection to avoid creating a new connection on every API call (hot reload)
const cached = globalThis as typeof globalThis & {
  mongoose?: {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
  };
};

cached.mongoose ??= { conn: null, promise: null };

export async function connectToDatabase() {
  if (cached.mongoose!.conn) {
    return cached.mongoose!.conn;
  }

  if (!cached.mongoose!.promise) {
    cached.mongoose!.promise = mongoose
      .connect(MONGODB_URI, {
        dbName: MONGODB_DB,
        serverSelectionTimeoutMS: 10_000,
        socketTimeoutMS: 45_000,
        connectTimeoutMS: 10_000,
        maxPoolSize: 10,
      })
      .then((m) => m);
  }

  cached.mongoose!.conn = await cached.mongoose!.promise;
  return cached.mongoose!.conn;
}

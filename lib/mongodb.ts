import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI as string;
const MONGODB_DB = process.env.MONGODB_DB as string;

if (!MONGODB_URI) {
  throw new Error(
    "Please define the MONGODB_URI environment variable in .env.local"
  );
}
if (!MONGODB_DB) {
  throw new Error(
    "Please define the MONGODB_DB environment variable in .env.local"
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
  const existing = cached.mongoose!.conn;
  if (existing?.connection.readyState === 1) {
    return existing;
  }
  if (existing?.connection.readyState === 2) {
    try {
      await existing.connection.asPromise();
      if (existing.connection.readyState === 1) return existing;
    } catch {
      // Clear a connection that was still opening but failed before becoming usable.
    }
    cached.mongoose!.conn = null;
    cached.mongoose!.promise = null;
  } else if (existing) {
    // A disconnected connection must not be handed to queries to buffer until timeout.
    cached.mongoose!.conn = null;
    cached.mongoose!.promise = null;
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

  try {
    cached.mongoose!.conn = await cached.mongoose!.promise;
  } catch (error) {
    // Drop the rejected promise so the next request retries instead of re-throwing forever.
    cached.mongoose!.promise = null;
    throw error;
  }
  return cached.mongoose!.conn;
}

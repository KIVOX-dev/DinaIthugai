import dns from "node:dns";
import mongoose from "mongoose";
import { env } from "./env";

type Cache = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };
const g = globalThis as unknown as { __mongoose?: Cache };
const cache: Cache = (g.__mongoose ??= { conn: null, promise: null });

export async function connectDB(): Promise<typeof mongoose> {
  if (cache.conn && mongoose.connection.readyState === 1) return cache.conn;
  const e = env();
  if (!e.MONGODB_URI) {
    throw new Error("MONGODB_URI is not set. Copy .env.example to .env.local and configure MongoDB Atlas.");
  }
  // NoSQL-injection defence: every external input is parsed by zod into primitive strings/numbers before it
  // reaches a query, so operator objects such as {"$ne": null} are rejected at the validation layer.
  mongoose.set("strictQuery", true);
  // Some networks refuse DNS SRV lookups (needed by mongodb+srv://). Allow overriding the resolvers.
  if (e.MONGODB_DNS_SERVERS) dns.setServers(e.MONGODB_DNS_SERVERS.split(",").map((x) => x.trim()).filter(Boolean));
  cache.promise ??= mongoose
    .connect(e.MONGODB_URI, { dbName: e.MONGODB_DB, maxPoolSize: 10, serverSelectionTimeoutMS: 8000 })
    .catch((err) => {
      cache.promise = null;
      throw err;
    });
  cache.conn = await cache.promise;
  return cache.conn;
}

/** Transactions need a replica set (Atlas always is). Falls back to plain execution otherwise. */
export async function withTransaction<T>(fn: (session: mongoose.ClientSession | undefined) => Promise<T>): Promise<T> {
  await connectDB();
  let session: mongoose.ClientSession | undefined;
  try {
    session = await mongoose.startSession();
    let out!: T;
    await session.withTransaction(async () => {
      out = await fn(session);
    });
    return out;
  } catch (err) {
    const msg = String((err as Error)?.message ?? err);
    if (/replica set|Transaction numbers are only allowed|not supported/i.test(msg)) {
      return fn(undefined);
    }
    throw err;
  } finally {
    await session?.endSession();
  }
}

export const oid = (v: string) => (mongoose.isValidObjectId(v) ? new mongoose.Types.ObjectId(v) : null);

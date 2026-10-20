import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import sharp from "sharp";
import { hashPassword } from "../../src/auth/crypto";
import { connectDB } from "../../src/db";
import { Category, EmailOutbox, User, ensureIndexes } from "../../src/models";
import { toPrincipal } from "../../src/services/auth";
import type { Principal } from "../../src/services/common";
import { setStorageForTests, type ObjectStorage } from "../../src/storage";
import type { Role } from "../../src/shared/permissions";

let mongod: MongoMemoryServer | null = null;

export class MemoryStorage implements ObjectStorage {
  kind = "local" as const;
  objects = new Map<string, Buffer>();
  async put(key: string, body: Buffer) {
    this.objects.set(key, body);
  }
  async get(key: string) {
    const b = this.objects.get(key);
    return b ? { body: b, contentType: "image/webp" } : null;
  }
  async delete(key: string) {
    this.objects.delete(key);
  }
}

export async function startTestDb() {
  mongod = await MongoMemoryServer.create();
  Object.assign(process.env, { MONGODB_URI: mongod.getUri(), MONGODB_DB: "test", NODE_ENV: "test", APP_URL: "http://localhost:3000", AI_API_KEY: "test-key" });
  await connectDB();
  await ensureIndexes();
  const storage = new MemoryStorage();
  setStorageForTests(storage);
  return storage;
}

export async function stopTestDb() {
  await mongoose.disconnect();
  await mongod?.stop();
}

export async function resetDb() {
  const cols = await mongoose.connection.db!.collections();
  await Promise.all(cols.map((c) => c.deleteMany({})));
}

let n = 0;
export async function makeUser(role: Role = "contributor", extra: Record<string, unknown> = {}): Promise<Principal> {
  n++;
  const u = await User.create({
    name: `${role} ${n}`,
    email: `${role}${n}@example.test`,
    normalizedEmail: `${role}${n}@example.test`,
    phone: "+919876543210",
    address: { line1: "1 Test St", city: "Coimbatore", state: "Tamil Nadu", postalCode: "641001", country: "India" },
    passwordHash: await hashPassword("Password123"),
    role,
    emailVerifiedAt: new Date(),
    consentAt: new Date(),
    ...extra,
  });
  return toPrincipal(u);
}

export async function makeCategory(slug = "tamil-nadu") {
  const c = await Category.create({ slug, name: { ta: "தமிழ்நாடு", en: "Tamil Nadu" } });
  return String(c._id);
}

export async function pngBuffer(w = 400, h = 300) {
  return sharp({ create: { width: w, height: h, channels: 3, background: { r: 30, g: 80, b: 200 } } }).png().toBuffer();
}

export async function lastEmail(to: string) {
  return EmailOutbox.findOne({ to }).sort({ createdAt: -1 }).lean();
}

export const words = (count: number, base = "word") => Array.from({ length: count }, (_, i) => `${base}${i}`).join(" ");

export const articleInput = (category: string, over: Record<string, unknown> = {}) => ({
  title: { ta: "", en: "A local story" },
  subtitle: { ta: "", en: "" },
  excerpt: { ta: "", en: "" },
  body: { ta: "", en: `<p>${words(120)}</p>` },
  preferredLanguage: "en",
  category,
  declaration: true,
  ...over,
});

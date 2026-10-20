import bcrypt from "bcryptjs";
import crypto from "node:crypto";

const COST = process.env.NODE_ENV === "test" ? 4 : 12;

export const hashPassword = (pw: string) => bcrypt.hash(pw, COST);
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);

// Used to equalise timing when the account does not exist.
export const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing", COST);

export const newToken = () => crypto.randomBytes(32).toString("base64url");
export const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

export function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

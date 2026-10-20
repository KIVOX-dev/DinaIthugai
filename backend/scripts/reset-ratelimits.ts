/**
 * Development helper: clears rate-limit counters so repeated test runs are not throttled.
 * Refuses to run when NODE_ENV=production.
 *   npm run dev:reset-ratelimits
 */
import mongoose from "mongoose";
import { connectDB } from "../src/db";
import { RateLimit } from "../src/models";

(async () => {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to reset rate limits in production.");
  await connectDB();
  const r = await RateLimit.deleteMany({});
  console.log(`cleared ${r.deletedCount} rate-limit counter(s)`);
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});

/**
 * Copies assets that were stored on local disk (development) into Backblaze B2 and re-points their records.
 * Idempotent: assets already on B2 are skipped; assets whose local files are missing are reported, not changed.
 *   npm run media:migrate-to-b2
 */
import mongoose from "mongoose";
import { connectDB } from "../src/db";
import { MediaAsset } from "../src/models";
import { getStorageFor } from "../src/storage";

(async () => {
  await connectDB();
  const local = getStorageFor("local");
  const b2 = getStorageFor("b2");
  const assets = await MediaAsset.find({ storage: "local" });
  let moved = 0;
  const missing: string[] = [];
  for (const m of assets) {
    const keys = [...new Set([m.key, ...m.variants.map((v) => v.key!).filter(Boolean)])];
    const objs = await Promise.all(keys.map(async (k) => [k, await local.get(k)] as const));
    if (objs.some(([, o]) => !o)) {
      missing.push(String(m._id));
      continue;
    }
    for (const [k, o] of objs) await b2.put(k, o!.body, "image/webp");
    m.storage = "b2";
    await m.save();
    moved++;
  }
  console.log(`migrated ${moved} asset(s) to B2; ${missing.length} skipped (files not on this machine)${missing.length ? ": " + missing.join(", ") : ""}`);
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});

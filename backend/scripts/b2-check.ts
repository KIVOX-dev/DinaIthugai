/** Verifies Backblaze B2 credentials with a real put / get / delete round trip.   npm run b2:check */
import { b2Configured } from "../src/env";
import { getStorageFor } from "../src/storage";

(async () => {
  if (!b2Configured()) throw new Error("B2_ENDPOINT / B2_BUCKET / B2_KEY_ID / B2_APPLICATION_KEY are not all set.");
  const s = getStorageFor("b2");
  const key = `healthcheck/${Date.now()}.txt`;
  const body = Buffer.from("dina idhigai b2 check");
  await s.put(key, body, "text/plain");
  const got = await s.get(key);
  if (!got || !got.body.equals(body)) throw new Error("Round trip failed: downloaded bytes differ.");
  await s.delete(key);
  const gone = await s.get(key);
  if (gone) throw new Error("Delete did not remove the object.");
  console.log("B2 OK: upload, download and delete all work on bucket", process.env.B2_BUCKET);
})().catch((e) => {
  console.error("B2 FAILED:", e.name ?? "", e.message ?? e);
  process.exit(1);
});

/**
 * Development helper: prints the most recent email logged for an address (non-production only: the dev email transport
 * stores messages in the emailoutboxes collection). Used by the e2e tests to follow verification / reset links.
 *   npm run dev:last-email -- someone@example.com
 */
import mongoose from "mongoose";
import { connectDB } from "../src/db";
import { EmailOutbox } from "../src/models";

(async () => {
  const to = process.argv[2];
  if (!to) throw new Error("usage: last-email <address>");
  await connectDB();
  const m = await EmailOutbox.findOne({ to }).sort({ createdAt: -1 }).lean();
  if (!m) {
    console.error("no email found");
    process.exitCode = 2;
  } else console.log(m.text);
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});

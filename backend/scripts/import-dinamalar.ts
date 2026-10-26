/**
 * Imports the latest Dinamalar Coimbatore news (licensed) as articles.
 *   npm run import:dinamalar            publish immediately
 *   npm run import:dinamalar -- --draft save as drafts for an editor to review
 *   npm run import:dinamalar -- --limit=20
 */
import mongoose from "mongoose";
import { importDinamalar } from "../src/import/dinamalar";

(async () => {
  const args = process.argv.slice(2);
  const limit = Number(args.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? 10);
  const r = await importDinamalar({ limit, publish: !args.includes("--draft") });
  console.log(r);
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

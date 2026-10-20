import mongoose from "mongoose";
import { ensureIndexes } from "../src/models";

(async () => {
  await ensureIndexes();
  console.log("MongoDB indexes created/verified.");
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

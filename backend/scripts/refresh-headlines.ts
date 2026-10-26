/** Rewrites today's homepage headline wording with AI:  npm run headlines:refresh */
import mongoose from "mongoose";
import { refreshHeadlines } from "../src/ai/headlines";

(async () => {
  console.log(await refreshHeadlines());
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

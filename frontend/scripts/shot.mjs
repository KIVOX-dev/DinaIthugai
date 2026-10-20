// Dev helper: screenshot a page. node scripts/shot.mjs <url> <out.png> [width] [fullPage]
import { chromium } from "@playwright/test";

const [url, out, w = "1440", full = "0"] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Number(w), height: 900 } });
await page.goto(url, { waitUntil: "networkidle" });
await page.screenshot({ path: out, fullPage: full === "1" });
await browser.close();
console.log("saved", out);

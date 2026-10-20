// Dev helper: loads pages at many viewport widths and reports horizontal overflow + offending elements.
//   node scripts/responsive-audit.mjs [baseUrl] [path ...]
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://localhost:3000";
const paths = process.argv.slice(3).length ? process.argv.slice(3) : ["/ta", "/en"];
const widths = [320, 360, 390, 430, 600, 768, 820, 1024, 1180, 1280, 1440, 1920, 2560];

const browser = await chromium.launch();
let problems = 0;
for (const path of paths) {
  for (const w of widths) {
    const page = await browser.newPage({ viewport: { width: w, height: 900 } });
    await page.goto(base + path, { waitUntil: "networkidle" });
    const r = await page.evaluate(() => {
      const de = document.documentElement;
      const over = de.scrollWidth - de.clientWidth;
      const offenders = [];
      if (over > 0) {
        for (const el of document.querySelectorAll("body *")) {
          const b = el.getBoundingClientRect();
          if (b.right > de.clientWidth + 1 && b.width > 0 && getComputedStyle(el).position !== "fixed") {
            let p = el.parentElement, clipped = false;
            while (p && p !== document.body) {
              const o = getComputedStyle(p).overflowX;
              if (o === "auto" || o === "hidden" || o === "scroll") clipped = true;
              p = p.parentElement;
            }
            if (!clipped) offenders.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 50)} right=${Math.round(b.right)}`);
          }
        }
      }
      return { over, offenders: offenders.slice(0, 4) };
    });
    if (r.over > 0) {
      problems++;
      console.log(`✗ ${path} @${w}px overflow ${r.over}px`, r.offenders);
    } else console.log(`✓ ${path} @${w}px`);
    await page.close();
  }
}
await browser.close();
console.log(problems ? `${problems} viewport(s) overflow` : "no horizontal overflow at any width");

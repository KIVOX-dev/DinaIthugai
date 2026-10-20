import { chromium } from "@playwright/test";
const b = await chromium.launch();
const p = await b.newPage();
await p.goto("http://localhost:3000/en");
const r = await p.evaluate(() => {
  const el = document.querySelector('nav a[aria-current="true"]');
  const sub = [...document.querySelectorAll("a")].find((a) => a.textContent?.includes("Submit an Article"));
  const f = (e) => e && { cls: e.className, color: getComputedStyle(e).color, bg: getComputedStyle(e).backgroundColor };
  return { langActive: f(el), submit: f(sub) };
});
console.log(JSON.stringify(r, null, 1));
await b.close();

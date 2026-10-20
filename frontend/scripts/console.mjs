import { chromium } from "@playwright/test";
const b = await chromium.launch();
const p = await b.newPage();
p.on("console", (m) => ["error", "warning"].includes(m.type()) && console.log(m.type(), m.text().slice(0, 400)));
p.on("pageerror", (e) => console.log("pageerror", e.message.slice(0, 400)));
await p.goto(process.argv[2], { waitUntil: "networkidle" });
await b.close();

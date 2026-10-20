// Copies the pure shared modules (permissions, locale config, article states) from the backend,
// which is the source of truth, so the UI never drifts from server rules.
import { cpSync, mkdirSync } from "node:fs";
mkdirSync("lib/shared", { recursive: true });
for (const f of ["permissions.ts", "i18n.ts", "article-states.ts"]) cpSync(`../backend/src/shared/${f}`, `lib/shared/${f}`);
console.log("shared modules synced");

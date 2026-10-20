// Builds the Catalyst AppSail deploy folder (../appsail-nodejs) from the backend.
//   npm run build:appsail      then, from the repo root:   catalyst deploy appsail
//
// Why a staging folder: AppSail runs on Linux x64, but node_modules installed on Windows contain the wrong native
// binaries (sharp). So we compile TypeScript, then install production dependencies *for linux-x64/glibc* into the folder.
import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = resolve(root, "..", "appsail-nodejs");
const run = (cmd, cwd) => execSync(cmd, { cwd, stdio: "inherit" });

console.log("1/4 compile TypeScript");
run("npm run build", root);

console.log("2/4 stage files ->", out);
for (const p of ["dist", "node_modules"]) rmSync(join(out, p), { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(join(root, "dist"), join(out, "dist"), { recursive: true });
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const slim = {
  name: pkg.name,
  version: pkg.version,
  private: true,
  main: "dist/server.js",
  engines: { node: ">=20" },
  scripts: { start: "node dist/server.js" },
  dependencies: pkg.dependencies,
};
writeFileSync(join(out, "package.json"), JSON.stringify(slim, null, 2));
if (existsSync(join(root, "package-lock.json"))) cpSync(join(root, "package-lock.json"), join(out, "package-lock.json"));

console.log("3/4 install production dependencies for linux-x64 (glibc)");
run("npm install --omit=dev --os=linux --cpu=x64 --libc=glibc --no-audit --no-fund", out);

// Opt-in: `npm run build:appsail -- --with-env --site-url https://your.vercel.app` copies an allow-list of keys from
// backend/.env into app-config.json (this file is git-ignored). Without the flag no secrets are written anywhere.
const withEnv = process.argv.includes("--with-env");
const siteArg = process.argv.indexOf("--site-url");
const secrets = {};
if (withEnv) {
  const KEYS = ["MONGODB_URI", "MONGODB_DB", "MONGODB_DNS_SERVERS", "CRON_SECRET", "B2_ENDPOINT", "B2_REGION", "B2_BUCKET", "B2_KEY_ID", "B2_APPLICATION_KEY", "AI_PROVIDER", "AI_MODEL", "AI_API_KEYS", "AI_BASE_URL", "SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "EMAIL_FROM", "UPLOAD_MAX_MB"];
  for (const line of readFileSync(join(root, ".env"), "utf8").split("\n")) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m && KEYS.includes(m[1]) && m[2]) secrets[m[1]] = m[2];
  }
  if (siteArg > -1) {
    secrets.FRONTEND_URL = process.argv[siteArg + 1];
    secrets.APP_URL = process.argv[siteArg + 1];
  }
  console.log("   injecting env keys:", Object.keys(secrets).join(", "));
}

console.log("4/4 write app-config.json");
writeFileSync(
  join(out, "app-config.json"),
  JSON.stringify(
    {
      command: "node dist/server.js",
      build_path: "./",
      stack: "node20",
      // Non-secret defaults only. Set MONGODB_URI, B2_*, AI_API_KEYS, CRON_SECRET, ... in the Catalyst console (never in git).
      env_variables: { NODE_ENV: "production", MONGODB_DB: "dinaidhigai", MONGODB_DNS_SERVERS: "8.8.8.8,1.1.1.1", ...secrets },
      memory: 512,
      // No predeploy/preserve npm install: it would replace the Linux binaries with Windows ones.
      scripts: {},
    },
    null,
    2,
  ),
);
console.log("\nReady. From the repo root run:  catalyst deploy appsail");

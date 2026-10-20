# Deployment

Architecture: **Vercel** hosts the Next.js frontend. The Express API (`backend/`) runs anywhere that can run a container
(Docker host, Fly.io, Render, Railway, a VM, Zoho Catalyst AppSail…). MongoDB Atlas stores data; Backblaze B2 stores images.

```
Browser ──► Vercel (Next.js)  ──/api/* rewrite──►  Backend container ──► MongoDB Atlas
                                                         └────────────► Backblaze B2
```

The browser only ever talks to the Vercel origin. `/api/*` is proxied to the backend by a Next.js rewrite, so the session
cookie is first-party (no third-party-cookie or CORS problems) and the backend is never exposed to browsers directly.

## 1. Backend (Docker)

```bash
cd backend
docker build -t dinaidhigai-backend .
docker run -d --name di-api -p 4000:4000 --env-file .env dinaidhigai-backend
curl http://localhost:4000/api/health      # {"ok":true,"db":"up"}
```

Required environment variables (see `backend/.env.example`): `MONGODB_URI`, `MONGODB_DB`, `FRONTEND_URL` (your Vercel URL),
`APP_URL` (same), `CRON_SECRET`, `B2_*`, `AI_*`, optionally `SMTP_*`. Set `NODE_ENV=production` so cookies are `Secure`.
If your network blocks SRV DNS lookups for `mongodb+srv://`, set `MONGODB_DNS_SERVERS=8.8.8.8,1.1.1.1`.

One-time setup against the production database (run from a machine with the env file):
```bash
cd backend && npm ci && npm run db:init
npm run admin:create -- --email you@example.com --name "Your Name" --password "a long passphrase"
```

Scheduled publishing: call `POST https://<api>/api/cron/publish-scheduled` with header `Authorization: Bearer $CRON_SECRET`
every 1–5 minutes (host cron, GitHub Actions, or your platform's scheduler). Public visibility does not depend on this job —
scheduled articles become visible at their time regardless — the job finalises status, sends notifications and cleans up unused uploads.

## 2. Frontend (Vercel)

1. Import the repository in Vercel and set **Root Directory = `frontend`**. Framework preset: Next.js (auto-detected;
   `frontend/vercel.json` pins region `bom1` and cache headers).
2. Add environment variables (Production + Preview):

   | Name | Value |
   | --- | --- |
   | `BACKEND_URL` | Public HTTPS URL of the backend, e.g. `https://api.example.com` (no trailing slash). **Needed at build time** — it is baked into the rewrite rules, so redeploy after changing it. |
   | `NEXT_PUBLIC_SITE_URL` | Your canonical site URL, e.g. `https://www.example.com` (used for canonical links, OG tags, structured data) |
   | `SESSION_COOKIE` | `di_session` (must match the backend; default is fine) |

3. On the backend set `FRONTEND_URL` and `APP_URL` to the same Vercel/custom domain (used by the CSRF origin check and email links).
4. Deploy. Check `https://<vercel-domain>/api/public/home?lang=en` returns JSON — that proves the rewrite reaches the backend.

Notes:
- Vercel limits request bodies on proxied routes; keep `UPLOAD_MAX_MB` ≤ 4 if uploads are rejected there.
- Keep the backend close to Atlas and to Vercel's region (`bom1` = Mumbai) for low latency.

## 3. Everything in Docker (local or self-hosted)

```bash
cp backend/.env.example backend/.env        # fill in values
docker compose up --build                   # site :3000, API :4000, uses Atlas
docker compose --profile local-db up --build   # also starts a local MongoDB replica set
```

## Security checklist

- `NODE_ENV=production`, HTTPS everywhere (cookies are `Secure; HttpOnly; SameSite=Lax`).
- Backblaze bucket is **private**; images are served only through `/api/media/*` which enforces publication state.
- Rotate any credential that was ever pasted into chat or committed. `.env` files are git-ignored.
- Restrict the Atlas IP access list to your backend's egress IPs.
- Review `audit` logs under Admin → Audit after go-live.

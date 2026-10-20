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

## 4. CI/CD pipeline (GitHub Actions)

| Workflow | Trigger | What it does |
| --- | --- | --- |
| `ci.yml` | every PR, every push to `main` | Backend: type-check, 11 integration tests against a real MongoDB, build — on **Node 20 (Catalyst)** and **Node 24**. Frontend: shared-modules sync check, lint, type-check, production build. Security: `npm audit` (prod deps, fail on high) + gitleaks secret scan over full history. Docker: builds both images. A final **`CI passed`** job is the single check to require. |
| `deploy-backend.yml` | push to `main` touching `backend/**`; manual | Re-runs CI, builds the Linux-x64 AppSail package with runtime config taken from GitHub secrets, deploys with the Catalyst CLI, then smoke-tests `/api/health` (requires `"db":"up"`). Secrets are deleted from the runner afterwards. |
| `scheduled-publish.yml` | every 5 min; manual | `POST /api/cron/publish-scheduled` with the cron secret (finalises scheduled articles, cleans unused uploads). |
| `dependabot.yml` | weekly | Dependency PRs for npm (backend, frontend), Docker and Actions. |

**Frontend deploys are handled by Vercel's Git integration** (preview on every PR, production on `main`). To make Vercel
wait for CI, enable *Settings → Git → "Require status checks / Deployment Checks"* in Vercel, or protect `main` in GitHub.

### One-time setup

1. **Branch protection** (GitHub → Settings → Branches → `main`): require a pull request and the status check **`CI passed`**.
2. **Catalyst token** — on your machine, once: `catalyst login` then `catalyst token:generate`. Save the token as the secret `CATALYST_TOKEN`.
3. **Repository secrets** (Settings → Secrets and variables → Actions → *Secrets*):
   `CATALYST_TOKEN`, `MONGODB_URI`, `CRON_SECRET`, `B2_KEY_ID`, `B2_APPLICATION_KEY`, `AI_API_KEYS` (comma-separated), and optionally `SMTP_USER`, `SMTP_PASSWORD`.
4. **Repository variables** (same page → *Variables*):

   | Variable | Example |
   | --- | --- |
   | `BACKEND_URL` | `https://dinaidhugai-50047009098.development.catalystappsail.in` (the deploy job stays skipped until this exists) |
   | `SITE_URL` | your Vercel / custom domain, e.g. `https://www.example.com` |
   | `MONGODB_DB` | `dinaidhigai` |
   | `MONGODB_DNS_SERVERS` | `8.8.8.8,1.1.1.1` (only if SRV lookups fail) |
   | `B2_ENDPOINT`, `B2_REGION`, `B2_BUCKET` | from your Backblaze bucket |
   | `AI_PROVIDER`, `AI_MODEL` | `groq`, `openai/gpt-oss-120b` |
   | `SMTP_HOST`, `SMTP_PORT`, `EMAIL_FROM` | optional |
5. Optional: create a GitHub **Environment** named `catalyst-development` and add required reviewers for manual deploy approval.

### Rollback
Re-run the `Deploy backend` workflow on a previous commit (Actions → run → *Re-run*), or `git revert` and push. Vercel keeps every
deployment: use *Instant Rollback* in the Vercel dashboard for the frontend.

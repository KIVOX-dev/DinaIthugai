# தின இதிகை · Dina Idhigai

A bilingual (Tamil / English) digital newspaper platform: public news site, contributor submission portal, and an editorial admin dashboard. Built with Next.js (App Router), TypeScript, Tailwind CSS, MongoDB Atlas and Backblaze B2.

> Status: work in progress. See [Implementation status](#implementation-status) for what exists today.

## Project structure

```
(project root)
backend/        SERVER-ONLY code (never imported by client components)
├── models/     Mongoose schemas + indexes
├── services/   Business logic: auth, users, media, settings, platform (email, audit, rate limit)
├── articles/   Article service, public & admin queries
├── ai/         Admin-only AI rewrite assistant
├── storage/    Backblaze B2 (S3 API) + local dev storage, image validation/processing
├── validation/ Zod schemas
├── auth/       Password/token crypto, current-user/session helpers
└── db.ts env.ts text.ts actions.ts
frontend/       UI layer
├── components/ React components (public site, forms, editor, admin)
├── i18n/       Tamil/English dictionary + formatting helpers
└── fonts.ts
shared/         Pure code used by both sides: permissions/roles, article state machine, locale config
app/            Next.js routes only (thin): pages, layouts, route handlers, server actions
├── [lang]/     Public site + auth + account (ta | en)
├── admin/      Editorial dashboard (/admin)
└── api/        Route handlers (media, uploads, AI, cron, feeds)
proxy.ts        Locale redirect + optimistic /admin gate
tests/
├── unit/  integration/  e2e/
```

> Next.js requires the routes folder to be `app/` at the project root (or `src/app`), so it cannot be nested inside `frontend/`. `node_modules` and `package.json` live at the root as usual.

Rule of thumb: `app/` calls `backend/services` (server) and renders `frontend/components`; `frontend` never imports `backend`; `shared` imports neither.

## Local setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in values (never commit `.env.local`).
3. `npm run db:init` creates all MongoDB indexes.
4. `npm run seed` loads clearly labelled **fictional** demo users/articles (optional).
5. `npm run dev` → http://localhost:3000 (redirects to `/ta`).

### Environment variables

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI`, `MONGODB_DB` | MongoDB Atlas connection |
| `APP_URL` | Public base URL (links in emails, canonical URLs, sitemaps) |
| `CRON_SECRET` | Bearer secret for `/api/cron/*` |
| `B2_ENDPOINT`, `B2_REGION`, `B2_BUCKET`, `B2_KEY_ID`, `B2_APPLICATION_KEY` | Backblaze B2 (S3-compatible). Use a **private** bucket. Without them, uploads fall back to local disk (development only) |
| `AI_PROVIDER`, `AI_MODEL`, `AI_API_KEY`, `AI_BASE_URL` | Admin AI assistant (`anthropic`, `openai`, or `openai-compatible`) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` | Email delivery. Without SMTP, email is written to an outbox collection in non-production and not delivered in production |
| `UPLOAD_MAX_MB`, `UPLOAD_MAX_DIMENSION` | Upload limits |

## Scripts

`dev`, `build`, `start`, `lint`, `test` (unit + integration), `test:e2e`, `db:init`, `seed`, `admin:create`.

## Implementation status

Done and tested (integration tests run against a real MongoDB):
- Data model, indexes, article state machine, permissions/roles
- Registration, email verification, login (lockout, rate limits), password reset, sessions
- Article save/revisions/slugs, submit → review → approve → publish, scheduling (idempotent), unpublish/archive
- Image upload validation + processing + private media delivery, media visibility synced with publication
- User management service (role escalation guards, suspend, export, deletion), AI assistant service
- Public query layer (homepage, categories, search, article detail, translation fallback)

In progress: UI (public site, account portal, admin dashboard), route handlers, SEO feeds, e2e tests, deployment docs.

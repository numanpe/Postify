# Postify

AI marketing/content platform. Built per the phased spec in `CLAUDE.md`.

## Status

**Phase 1 (Foundation) and Phase 2 (AI Content Director, text-only)
implemented and verified end-to-end against a real Postgres.** See
`CLAUDE.md` for the full spec, phase table, and working rules.

- Phase 0 (Audit) — done. Repo was empty at audit time; no legacy code to
  classify Keep/Refactor/Delete.
- Phase 1 (Foundation) — done. Signup/login (Auth.js, credentials),
  company onboarding, Brand Kit (logo + colors/fonts), Media Library
  (upload/list/delete), mobile-first shell. Verified with a scripted
  browser (Playwright) driving the real UI against a live Neon Postgres:
  sign up → create company → upload logo → upload media → delete →
  sign out → route protection on `/media`/`/brand-kit`/`/create-company`
  → re-login, all passed. Multi-tenant isolation was verified
  separately: a second company's media library came back empty, and
  fetching the first company's storage URL directly returned 403 as a
  member of a different company and 401 when unauthenticated. Test data
  was deleted afterward.
- Phase 2 (AI Content Director) — done, text generation only (image/
  video providers are Phase 3/4). Provider abstraction (`TextProvider`)
  with a free, zero-key template path (industry packs + company context
  filled into templates — no LLM call) and BYOK OpenAI/Anthropic
  adapters, encrypted at rest. Verified: generated the same caption
  topic across three company profiles (Agriculture, Education, Real
  Estate) and confirmed the outputs were genuinely different, each
  correctly referencing its own company; saved an invalid OpenAI key
  and confirmed the real API call fails with 401 and the UI surfaces an
  explicit error rather than silently falling back to the free template.
  Settings correctly shows only a masked key preview after saving.
- Auto-tagging in the Media Library is still structural only (mime
  type, dimensions, orientation) — semantic tags need a vision
  provider, which Phase 2 didn't add (text only).
- Arabic/RTL UI has not been built yet. The schema stores a per-company
  `Locale`, but the English path was the one built and verified first.

## Stack

- **Next.js 16 (App Router, TypeScript)** — frontend and backend API
  (Route Handlers + Server Actions) in one deployable, per the spec's
  "avoid microservices" rule. Deploys anywhere Node runs; not locked to a
  specific host. Note: Next 16 renamed `middleware.ts` → `proxy.ts` — this
  repo uses the new convention.
- **PostgreSQL + Prisma** — local dev via Docker Compose; any Postgres
  works in production.
- **Auth.js (self-hosted, credentials-based, JWT sessions)** — no required
  third-party auth vendor, in line with the spec's free-first principle.
- **Local-disk storage abstraction** (`src/lib/storage.ts`) — one
  implementation for now, shaped so a real object-storage backend can
  replace it later without touching callers.
- **Text provider abstraction** (`src/lib/providers/text/`) — free
  template provider (no key, no LLM) plus BYOK OpenAI/Anthropic
  adapters. Keys are AES-256-GCM encrypted at rest
  (`CREDENTIALS_ENCRYPTION_KEY`); the app has no shared/default provider
  key of its own.
- **Tailwind CSS** — mobile-first styling.
- Background worker is intentionally not built yet — nothing through
  Phase 2 needs async jobs.

## Local setup

```bash
cp .env.example .env        # fill in DATABASE_URL / DIRECT_URL / AUTH_SECRET / CREDENTIALS_ENCRYPTION_KEY
docker compose up -d        # starts local Postgres
npm install
npm run db:migrate          # applies the schema
npm run dev
```

`AUTH_SECRET`: `npx auth secret`. `CREDENTIALS_ENCRYPTION_KEY`: `node -e
"console.log(require('crypto').randomBytes(32).toString('base64'))"`.

`DIRECT_URL` only matters when `DATABASE_URL` goes through a connection
pooler (e.g. Neon's default pooled endpoint) — migrations need the
unpooled connection. For the Docker Postgres above, both variables can
point at the same URL.

## Structure

```
src/app/                     Next.js App Router routes
  (auth)/login, (auth)/signup             public
  (onboarding)/create-company             first company setup
  (app)/media, (app)/brand-kit            company-scoped, behind proxy.ts
  (app)/studio, (app)/settings            content generation, BYOK keys
  api/auth/[...nextauth]                  Auth.js route handler
  api/storage/[...key]                    serves uploaded media (membership-checked)
src/lib/
  providers/text/             TextProvider interface + template/OpenAI/Anthropic
  industry-packs.ts           per-industry tone/hook/value-prop/CTA content
  company-context.ts          assembles Company + Creative DNA for generation
  crypto.ts                   AES-256-GCM for BYOK key storage
  db client, session/company helpers, storage abstraction, server actions
src/components/               form components per feature
proxy.ts                      route protection (Next 16's middleware.ts)
prisma/                       database schema
docker-compose.yml            local Postgres for dev
```

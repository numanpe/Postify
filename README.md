# Postify

AI marketing/content platform. Built per the phased spec in `CLAUDE.md`.

## Status

**Phases 1–3 (Foundation, AI Content Director text, Poster Engine)
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
- Phase 3 (Poster Engine) — done: real pipeline (Satori + resvg,
  bundled Lato/Tajawal fonts), not a template gallery with baked-in
  text. Background sources: free brand-color gradient, a real photo
  from the Media Library, or BYOK AI generation (OpenAI `gpt-image-1`,
  same key as Phase 2's text BYOK). RTL is detected from the headline's
  actual script, not a stored locale, so a company can produce both an
  English and an Arabic poster. Quality gate: a real WCAG contrast-ratio
  guarantee computed from the exact scrim/font-size design (not sampled
  after the fact), plus a locale/script mismatch warning; a spelling
  gate is explicitly *not* implemented (documented gap, not faked) since
  a real one needs a dictionary. Verified by generating real posters
  across all three aspect ratios, English and Arabic, brand-gradient and
  real-photo backgrounds, then **visually inspecting the rendered PNGs**
  — not just checking they didn't crash. That inspection caught two real
  bugs before they shipped: the background-photo picker could
  accidentally select a previously *generated* poster as the "photo"
  source for a new one (fixed — poster outputs are now excluded from
  that picker), and non-PNG background images (e.g. an uploaded JPEG)
  rendered as a blank canvas because the data-URI mime type was
  hardcoded to `image/png` regardless of the actual file (fixed —
  threads the real mime type through). AI background generation was
  only verified on its failure path (no key configured -> real 401 from
  OpenAI, explicit error, no silent fallback) — a successful AI
  generation hasn't been verified against a real OpenAI key.
- Auto-tagging in the Media Library is still structural only (mime
  type, dimensions, orientation) — semantic tags need a vision
  provider, not added yet.
- Arabic/RTL is verified for poster rendering (Phase 3). Arabic *content
  generation* (Phase 2's TextProvider) is still English-only — a company
  can type Arabic copy directly and it renders correctly, but nothing
  generates Arabic copy for them yet. The rest of the UI chrome (nav,
  forms) is also English-only so far.

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
- **Image provider abstraction** (`src/lib/providers/image/`) — free
  brand-gradient provider (`sharp`-rendered SVG) plus a BYOK OpenAI
  `gpt-image-1` adapter, reusing the same stored OpenAI credential as
  the text provider.
- **Poster render pipeline** (`src/lib/poster/`) — Satori (JSX → SVG,
  real flexbox layout, native RTL support) + `@resvg/resvg-js`
  (SVG → PNG). Bundled OFL-licensed fonts (Lato/Tajawal) so it works
  offline with no runtime font fetching.
- **Tailwind CSS** — mobile-first styling.
- Background worker is intentionally not built yet — nothing through
  Phase 3 needs async jobs (poster/caption generation runs inline in
  the request).

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
  (app)/studio, (app)/settings, (app)/poster   generation, BYOK keys, posters
  api/auth/[...nextauth]                  Auth.js route handler
  api/storage/[...key]                    serves uploaded media (membership-checked)
src/lib/
  providers/text/, providers/image/   TextProvider / ImageProvider + adapters
  poster/                     Satori+resvg render pipeline, quality gate, fonts
  industry-packs.ts           per-industry tone/hook/value-prop/CTA content
  company-context.ts          assembles Company + Creative DNA for generation
  crypto.ts                   AES-256-GCM for BYOK key storage
  db client, session/company helpers, storage abstraction, server actions
src/components/               form components per feature
assets/fonts/                 bundled OFL fonts (Lato, Tajawal) for posters
proxy.ts                      route protection (Next 16's middleware.ts)
prisma/                       database schema
docker-compose.yml            local Postgres for dev
```

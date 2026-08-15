# Postify

AI marketing/content platform. Built per the phased spec in `CLAUDE.md`.

## Status

**Phases 1–5 (Foundation, AI Content Director text, Poster Engine, Video
Engine, Campaigns & Calendar) implemented and verified end-to-end
against a real Postgres.** See `CLAUDE.md` for the full spec, phase
table, and working rules.

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
- Phase 4 (Video Engine) — done: idea -> script (hook/context/value/
  message/CTA, industry-templated, extends Phase 2's TextProvider) ->
  scenes (real photos/videos from the Media Library, cycling to fill
  gaps, or BYOK AI stills — no separate video-generation vendor, see
  below) -> word-level burned-in captions (Satori/resvg, same RTL-
  correct renderer as posters) -> bundled royalty-free music with real
  sidechain-compressor auto-ducking under narration -> logo branding ->
  automated quality gate (ffmpeg `blackdetect` for black frames,
  `volumedetect` for audio clipping, a real duration check for timing
  desync, script/locale mismatch check) -> MP4 via `@ffmpeg-installer/
  ffmpeg`. Spoken narration is BYOK-only (OpenAI TTS + Whisper for real
  word-level timestamps, not a words-per-minute estimate) — the free
  tier ships without a voice track, relying on captions + music + real
  footage instead (see the project decision below). "AI B-roll" reuses
  Phase 3's `ImageProvider` for still images used as supplementary
  scenes among real footage, not a dedicated video-generation vendor
  (Runway/Luma-style) — deferred as a future enhancement, not built.
  Verified by generating a real ~22s MP4 end-to-end against live Neon,
  then checking it for real: ffprobe metadata (exact expected duration,
  correct codecs), **extracted frames viewed with the Read tool** across
  all five script sections (logo present and undistorted in every
  frame, captions correctly timed and readable, scene-cycling fallback
  working when fewer photos than sections were provided), and an audio
  volume check confirming the music track is genuinely audible
  (-20.3dB mean, -6.6dB peak — not silent, not clipping). That
  inspection caught and fixed a real bug: the branding/caption overlay
  step had no explicit output duration bound, so with looped
  (infinite-duration) logo/caption image inputs the ffmpeg process
  never terminated on its own — confirmed as a genuine runaway process
  (197+ accumulated CPU-seconds) before being fixed with an explicit
  `-t` bound. Also fixed the same "generated/branding asset leaks into
  the source-footage picker" class of bug Phase 3 hit: the brand kit
  logo was selectable as B-roll footage in both the Video and Poster
  Studio pickers (now excluded from both). The BYOK narration failure
  path was verified with a deliberately invalid key: real 401, explicit
  error, no video generated. A successful BYOK narration/AI-still run
  hasn't been verified against real OpenAI credentials. The `/api/
  storage/[...key]` route has no HTTP Range support, so video seeking/
  scrubbing in the player works less smoothly than a CDN-backed video
  host would — acceptable for the short (15-30s) clips this produces,
  flagged rather than silently accepted as ideal.
- Phase 5 (Campaigns & Calendar) — done. Orchestration on top of the
  existing pipelines rather than a new generation engine: an objective
  + date range produces one `generateCampaignPlan` call (extends Phase
  2's `TextProvider` again) up front — a coherent announce -> feature ->
  social-proof -> urgency -> recap arc, not N unrelated topics — then
  each day reuses the *existing* poster pipeline with its own angle as
  the topic. Campaign items are posters only for v1 (SQUARE, free brand
  gradient); video items and background-source variety are deferred, to
  keep the new job/retry machinery this phase adds provably correct
  rather than also re-testing variety Phase 3/4 already covers.
  Background jobs are a plain Postgres-backed table (retryCount/
  nextAttemptAt directly on `CampaignItem`, no Redis/queue service —
  matches CLAUDE.md's simple-stack preference and there's exactly one
  job type so a generic queue abstraction would be premature), with
  three trigger paths: fire-and-forget right after campaign creation
  (a head start, not a delivery guarantee on serverless — see
  `src/lib/jobs/trigger.ts`), a `CRON_SECRET`-gated
  `/api/jobs/process-campaign-items` route for a real external
  scheduler in production (`vercel.json` wires this to Vercel Cron;
  any other host needs its own scheduler hitting the same URL with the
  bearer token), and a manual "Process now" button — which was also
  this session's actual verification path, since there's no way to
  trigger a real external cron without deploying. Approval workflow
  (PENDING -> READY -> APPROVED, or FAILED) and per-item edit
  (change the angle text, regenerate) / remove are real status
  transitions, not fake UI state.
  Verified against live Neon: created a real 5-day campaign and
  confirmed the generated angles were genuinely distinct (not the same
  idea repeated) and followed the intended arc; processed the queue to
  completion and **visually inspected two of the rendered posters** to
  confirm they're real, correctly-branded output, not placeholders;
  exercised approve, edit+regenerate (confirmed the regenerated poster
  is genuinely different, not the same image reused), and remove
  end-to-end. The retry/backoff logic specifically was tested by
  directly seeding `CampaignItem` rows in two states — one eligible for
  retry (`retryCount` below the cap) and one at the max-retry cutoff —
  then confirming the processor picked up and successfully retried the
  first while correctly leaving the second alone (still `FAILED`,
  unresolved without a manual retry) rather than looping on it forever.
  The `CRON_SECRET` auth gate on the scheduler route was verified
  directly (no token -> 401, wrong token -> 401, correct token -> 200
  with a real result). Test data deleted after.
- Auto-tagging in the Media Library is still structural only (mime
  type, dimensions, orientation) — semantic tags need a vision
  provider, not added yet.
- Arabic/RTL is verified for poster rendering (Phase 3) and for the
  video caption-compositing mechanism generally (Phase 4 reuses the
  same Satori/resvg renderer end-to-end), but a full Arabic *video* run
  wasn't independently executed this session — the free-tier script
  generator is still English-only (see below), so producing an Arabic
  video script requires BYOK, which wasn't exercised for this specific
  combination. Arabic *content generation* (Phase 2's TextProvider) is
  still English-only — a company can type or paste Arabic copy directly
  and it renders correctly in posters/videos, but nothing generates
  Arabic copy for them yet. The rest of the UI chrome (nav, forms) is
  also English-only so far.

**Project decision (2026-08-16):** the free tier ships videos without
spoken narration by design, not as an oversight — there's no zero-cost
synthetic-speech analog the way there is for text (templates) or images
(gradients). The user chose BYOK-only narration over bundling a local
neural TTS engine after a licensing check found the actively-maintained
option (Piper's `piper1-gpl` fork) moved to GPL in Oct 2025, with real
unresolved questions about bundling it into a commercial product and
about separate per-voice-model licensing.

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
  offline with no runtime font fetching, shared with the video pipeline's
  captions via `src/lib/fonts.ts`.
- **Voice provider abstraction** (`src/lib/providers/voice/`) — BYOK
  only (OpenAI TTS + Whisper for real word-level timestamps), reusing
  the same stored OpenAI credential as text/image. No free-tier
  implementation — see the Status section above for why.
- **Video render pipeline** (`src/lib/video/`) — `@ffmpeg-installer/
  ffmpeg` + `@ffprobe-installer/ffprobe` (bundled per-platform binaries,
  same packaging pattern as `resvg-js`), captions rendered via the same
  Satori/resvg engine as posters, a small bundled royalty-free music
  library (`assets/music/`, CC-BY, mood-mapped by industry) with real
  ffmpeg `sidechaincompress` auto-ducking, and a quality gate built on
  ffmpeg's own `blackdetect`/`volumedetect` analysis filters.
- **Background jobs** (`src/lib/jobs/`) — a plain Postgres-backed queue
  (retry bookkeeping directly on `CampaignItem`), not Redis/BullMQ or a
  hosted queue service. Poster/video generation outside of campaigns
  still run inline in the request (fast enough not to need queuing).
- **Tailwind CSS** — mobile-first styling.

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

Video generation shells out to a bundled ffmpeg binary and can take
under a minute for a short clip — no extra setup needed, but expect the
`/video` request to take noticeably longer than other pages.

`DIRECT_URL` only matters when `DATABASE_URL` goes through a connection
pooler (e.g. Neon's default pooled endpoint) — migrations need the
unpooled connection. For the Docker Postgres above, both variables can
point at the same URL.

Campaign background jobs work locally without any extra setup — every
campaign creation and edit/retry action kicks off a best-effort
processing pass immediately, and the "Process now" button on a
campaign page always works. `CRON_SECRET` only matters for wiring a
real external scheduler in production (see `vercel.json` for the
Vercel Cron example); leave it unset in local dev.

## Structure

```
src/app/                     Next.js App Router routes
  (auth)/login, (auth)/signup             public
  (onboarding)/create-company             first company setup
  (app)/media, (app)/brand-kit            company-scoped, behind proxy.ts
  (app)/studio, (app)/settings, (app)/poster, (app)/video   generation, BYOK keys
  (app)/campaigns, (app)/campaigns/[id]   campaign list + calendar grid
  api/auth/[...nextauth]                  Auth.js route handler
  api/storage/[...key]                    serves uploaded media (membership-checked)
  api/jobs/process-campaign-items         CRON_SECRET-gated batch job processor
src/lib/
  providers/text/, providers/image/, providers/voice/   provider abstractions + adapters
  poster/                     Satori+resvg render pipeline, quality gate, reusable generate.ts core
  video/                      ffmpeg pipeline: scenes, captions, music, quality gate
  jobs/                       background job processor, retry/backoff, triggers
  fonts.ts                    bundled fonts, shared by posters and video captions
  industry-packs.ts           per-industry tone/hook/value-prop/CTA/script/campaign-arc content
  company-context.ts          assembles Company + Creative DNA for generation
  campaign-calendar.ts        UTC-safe week-grid date math for the calendar view
  crypto.ts                   AES-256-GCM for BYOK key storage
  db client, session/company helpers, storage abstraction, server actions
src/components/               form components per feature
assets/fonts/                 bundled OFL fonts (Lato, Tajawal)
assets/music/                 bundled CC-BY royalty-free tracks
proxy.ts                      route protection (Next 16's middleware.ts)
vercel.json                   Vercel Cron example for the job processor
prisma/                       database schema
docker-compose.yml            local Postgres for dev
```

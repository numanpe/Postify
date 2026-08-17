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
  threads the real mime type through). "AI Background" now works with
  zero keys: a company with no OpenAI key gets Pollinations (free,
  open-source-model, no signup — `src/lib/providers/image/
  pollinations-provider.ts`), an OpenAI key gets `gpt-image-1` instead
  for higher/more predictable quality — see the 2026-08-17 project
  decision below. Verified live: a real zero-key AI-background poster
  generated and visually inspected end-to-end, and the honest-failure
  path forced and confirmed (a broken free-provider endpoint produces
  the clear "AI background unavailable right now — try again shortly"
  message and creates no poster record, not a silent fallback or fake
  success). BYOK OpenAI generation itself is still only verified on its
  failure path (invalid key -> real 401, explicit error) — a successful
  BYOK generation hasn't been verified against a real OpenAI key.

**Poster Studio Template Overhaul (2026-08-16):** the original single
hardcoded design (full photo + bottom scrim) is now 4 real, visually
distinct templates (`src/lib/poster/templates.tsx`) — Minimal, Bold
Headline, Promotional Banner, Split Product — each with its own layout,
type scale, and CTA treatment, selectable in the Poster Studio form and
by campaign auto-generation (defaults to Minimal). The quality gate
(`quality-gate.ts`) was generalized to a `TemplateContrastSpec` union:
Minimal/Bold Headline use a worst-case overlay-scrim contrast proof
(assumes a pure-white photo, the darkest-possible case), Promotional
Banner/Split Product put text on a solid brand-color panel instead,
proven ≥4.58:1 by construction via `readableTextColor` — a stronger
guarantee needing no per-aspect-ratio computation. The Poster Studio
form's background-source default was also fixed to prefer an actual
uploaded photo (`PHOTO`, most recent first) over the flat brand
gradient whenever the company has one, computed server-side and passed
down as props. Verified by generating real posters across all 4
templates, English and Arabic (RTL logo/text mirroring included), all 3
aspect ratios, real brand colors and the neutral fallback, and a
near-max-length headline/subhead stress test — visually inspecting every
render. That inspection caught two real bugs: a `left: undefined` key
spread into a Satori style object crashed 3 of the 4 templates (Satori's
style parser calls `.trim()` on every value; an explicit `undefined`
isn't tolerated the way it would be in real CSS) — fixed by only
including the relevant side key. And Promotional Banner's fixed-height
band would overflow (text bleeding into the photo above it) for
realistic headline lengths — fixed by making both panel templates
auto-size to their content (`flex: 1` / `minHeight: 0` on the photo)
instead of a hardcoded pixel split.
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
  ffmpeg`. Spoken narration is free by default via edge-tts (Microsoft's
  unofficial "Read Aloud" endpoint, `msedge-tts`) — real per-word
  timestamps come straight from its synthesis stream, no separate
  transcription pass needed. A company can opt into BYOK (OpenAI TTS+
  Whisper, or ElevenLabs' own alignment endpoint) instead via the
  Settings voice engine toggle, for studio-grade quality or if the free
  community engine is unavailable (see the 2026-08-17 project decision
  below, which supersedes the original 2026-08-16 BYOK-only call).
  "AI B-roll" reuses
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

**AI Creative Director / multi-asset Campaign Generator (2026-08-17):**
Phase 5's poster-only limitation above is lifted — `generateCampaignPlan`
(angles only) is replaced by `TextProvider.generateCampaignBrief`, which
produces a full per-day execution brief: `campaignType` (free text,
inferred from the objective — deliberately not a Prisma enum, since SME
industries need types beyond "Product Launch/Seasonal Sale/Educational/
Flash Promo/Customer Story"), and per item: `assetType` (`POSTER` or
`VIDEO` — only these two, since only these two have a real backing
renderer; offering "carousel" would be fake functionality), poster
headline/subhead/cta or a video topic, a caption, hashtags, a suggested
posting time, and `targetPlatforms` sourced only from the company's
actually-connected `SocialAccount` rows (never a platform this app has
no integration for, like TikTok). A multi-day campaign opens with one
video (a stronger first asset) and fills the rest with posters
(cheaper, faster, always free-tier viable) — a deliberate, deterministic
mix, not every item defaulting to the heavier asset type.
`generateVideoCore` was extracted from the Video Studio's `generateVideo`
action (same split `generatePosterCore` already had) so the campaign job
processor can drive real video generation without a fake form
submission; it also auto-selects the company's most-recently-uploaded
media as B-roll for campaign videos (mirroring the Poster Studio's
photo-first default), since there's no UI in an unattended background
job for a person to pick footage and the video pipeline's AI-still
fallback stays BYOK-only. BYOK's brief generation is real, locale-aware
Arabic generation (not just English templates translated) and enforces
the "no AI filler words" constraint (unleash/delve/game-changer/
elevate/unlock/etc.) with real post-hoc validation of the LLM's output,
not just a prompt instruction — not live-tested, no working BYOK key
this session.
Verified against live Neon + Blob: created a real 2-day campaign (1
video + 1 poster) for a real company with real uploaded photos, and
generating both surfaced two genuine grammar bugs invisible from the
JSON alone — the campaign's already-sentence-shaped `angle` was being
spliced as `{{topic}}` into caption *and* video-script templates that
also wrap `{{topic}}` into a sentence, producing "We put the same care
into What makes X worth it. That we put into every harvest." Fixed by
using the raw objective (never pre-wrapped) as `{{topic}}` instead, for
both the caption builder and the video's topic input — confirmed with a
regenerated real poster and video afterward, both grammatically clean.
Arabic was verified for the poster path end-to-end with real Arabic
text through the actual multi-asset item pipeline (correct RTL
headline/subhead/CTA alignment). For video, `src/lib/video/captions.tsx`
was confirmed by direct code inspection to call the identical
`detectDirection` function already proven correct for posters — but a
live all-Arabic *video* wasn't produced this session: the free tier's
`generateScript` is English-only (pre-existing, documented above) and,
unlike posters (which accept a pre-written headline directly), the
video pipeline always generates its own script from a topic rather than
accepting a pre-written one, so there's no zero-key path to a genuinely
Arabic-scripted video without a BYOK key. Test data deleted after.
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

**Project decision (2026-08-16, superseded 2026-08-17):** the free tier
originally shipped videos without spoken narration by design, not as an
oversight — there was no zero-cost synthetic-speech analog the way
there is for text (templates) or images (gradients). The user chose
BYOK-only narration over bundling a local neural TTS engine after a
licensing check found the actively-maintained option (Piper's
`piper1-gpl` fork) moved to GPL in Oct 2025, with real unresolved
questions about bundling it into a commercial product and about
separate per-voice-model licensing.

**Project decision (2026-08-17):** after a real poster-quality audit
prompted a broader look at default output quality, the user asked for a
genuinely free narration path rather than accepting BYOK-only as
permanent. edge-tts (Microsoft's unofficial, reverse-engineered Edge
"Read Aloud" WebSocket endpoint, via the actively-maintained `msedge-tts`
npm package) fills that gap: free, no key, real per-word timestamps from
its own synthesis stream. It's explicitly not a documented/supported
Microsoft API and can change or degrade without notice — the user
accepted that risk knowingly, on the condition that it's clearly labeled
in the UI as a community engine (see Settings) rather than presented as
an official, guaranteed-stable service. `Company.voiceEngine` (FREE by
default, BYOK opt-in) makes this an explicit per-company choice rather
than the implicit "BYOK wins if a key exists" pattern text/image
providers use — voice generation can carry real per-call cost, so
switching a company onto a paid path should never happen silently just
because a credential exists for another capability. BYOK now also
supports ElevenLabs (`AiProviderKind.ELEVENLABS`) alongside OpenAI,
using ElevenLabs' own with-timestamps endpoint (character-level
alignment aggregated into words) rather than a Whisper-style
transcription pass — this path is implemented but hasn't been verified
against a real ElevenLabs API key (no key was available this session);
the free edge-tts path and the resolver's FREE/BYOK/no-credential
branching were all verified with a real end-to-end video generation
against live Neon + Blob storage, inspected frame-by-frame.

**ISR Writes quota (2026-08-17):** hit the Vercel Hobby plan's 200k/month
ISR Writes limit. Audited the whole codebase for the usual causes — a
short `export const revalidate`, a low-interval `fetch(..., {next:
{revalidate}})`, Pages Router `getStaticProps` — and found none; every
route already renders fully dynamic (confirmed in every build output
above). The actual cause: Vercel counts *on-demand* revalidation
(`revalidatePath`/`revalidateTag`) as ISR writes too, not just
time-based ISR, and this app called `revalidatePath` after every poster
generation, video generation, and media upload — all high-frequency
actions — confirmed via `vercel metrics schema`, which lists
`vercel.isr_operation.write_units` as a tracked metric for this project
(the exact per-route breakdown needs Observability Plus, which this
account's plan doesn't have). Fixed by moving those three call sites
from a server-side `revalidatePath` to a client-side `router.refresh()`
fired from a `useEffect` after the action reports success
(`poster-form.tsx`, `video-form.tsx`, `upload-media-form.tsx`) — same
"show the new item without a manual reload" UX, but a plain refetch
instead of a metered cache-invalidation write. `deleteMedia` and the
lower-frequency actions (campaign items, publish jobs, settings) keep
`revalidatePath`, since those are void actions bound directly to a
`<form>` with no client component able to trigger a refresh, and their
volume is low enough not to matter. Verified the server side still
completes correctly post-change (a real poster generation, zero
`revalidatePath` call, no regression); the client-side auto-refresh
itself couldn't be visually confirmed in a live browser this session —
the Chrome extension wouldn't connect — so that specific piece is
reviewed-correct but not click-tested.

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
- **Voice provider abstraction** (`src/lib/providers/voice/`) — FREE by
  default via `msedge-tts` (unofficial Microsoft edge-tts, real per-word
  timestamps from its own synthesis stream); BYOK opt-in via
  `Company.voiceEngine` routes to OpenAI TTS+Whisper or ElevenLabs'
  with-timestamps endpoint instead, sharing the same stored credential
  as text/image where applicable. See the 2026-08-17 project decision
  above.
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

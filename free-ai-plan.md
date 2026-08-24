# Execution Context: Zero-Setup "Free AI" — First-Come-First-Serve, Extended to Image & Video

Revises the earlier plan: NO per-company caps. Use a single shared
platform-wide daily quota per provider, first-come-first-serve — once
the real provider's daily limit is hit for the day, everyone falls back
gracefully (templates for text, uploaded media requirement for video/
image) until the quota resets. Extend this pattern to image and video,
not just text.

---

## Part 1: Text (as previously scoped)

Gemini text (Flash/Flash-Lite), platform-held key, no per-company cap —
first-come-first-serve against the real daily quota. When the shared
quota is exhausted for the day, fall back to Templates gracefully, with
a clear message ("Today's free AI quota is used up — templates still
work, or connect your own free Gemini key in Settings for unlimited
access").

## Part 2: Image — Real, Confirmed Option

1. Add Gemini's image model (Nano Banana / Gemini 2.5+ Flash Image) as
   a platform-held, zero-setup image provider — this directly closes
   the gap where poster AI-background generation currently requires
   either a BYOK key or falls back to a brand gradient.
2. Real free quota is meaningfully larger than video (roughly 500/day
   per recent findings, verify the real current number from Google's
   official docs before implementing) — still first-come-first-serve,
   no per-company cap, shared platform-wide.
3. When the shared image quota is exhausted for the day: fall back to
   the existing brand-gradient background (already built, zero cost)
   rather than erroring — same graceful-degradation standard as
   everything else.

## Part 3: Video — Real, But Honestly Very Limited

1. Add Google Veo (via the Gemini API/ecosystem) as a platform-held,
   zero-setup option specifically for the AI B-roll generation slot
   that currently returns null without a BYOK OpenAI key (per the
   earlier investigation — this directly fills that named gap).
2. Verify the real current free-tier terms directly from Google's
   official docs before implementing — the real limit found in
   research is approximately 3 generations per 24 hours, which is
   extremely small for a platform-wide shared pool. Confirm this exact
   number is current, since video free tiers change frequently.
3. Be honest in the implementation and in what you tell me: with a
   limit this small shared across the whole platform, this will likely
   be exhausted within the first one or two real video generations each
   day, not something most users will reliably get. Build it anyway
   (first-come-first-serve, no per-company cap, since the natural
   scarcity makes an artificial cap somewhat moot at this quota size),
   but do not present this as a reliable default in the UI — frame it
   honestly as "occasionally available free AI B-roll" rather than "the
   new default video experience."
4. When the shared video quota is exhausted (which will be often): the
   EXISTING fallback behavior (require real uploaded media, or a BYOK
   key) remains exactly as it is now — this doesn't change or weaken
   that existing, correct behavior, it just adds one more free
   possibility on top when the daily quota happens to be available.
5. Do NOT implement Seedance 2.0, or any other video provider, based
   on third-party blog/reseller claims of a "generous free tier."
   Specifically verified and ruled out: Seedance 2.0's official
   ByteDance/BytePlus documentation states no free API tier exists and
   requires prepaid billing from the first call — the "100 free daily
   credits, watermark-free" claims circulating online come from
   third-party resellers (PiAPI, EvoLink, Creen, etc.), not the actual
   provider, and are not reliable to build on. This is a broader
   pattern worth watching for: video-generation "free tier" claims
   online are frequently inflated SEO content, more so than for text/
   image. Before implementing ANY video provider beyond Veo, verify
   directly against that provider's own official pricing/API
   documentation page — never a third-party blog or reseller site. If
   a provider's own official docs don't clearly confirm a sustainable,
   no-card free API tier, treat it as NOT free and do not implement it
   as part of this "zero-setup" system.

## Part 4: Platform-Held Credentials & Safety

1. All three (text, image, video) use securely stored, platform-level
   API keys — never exposed client-side, same security standard as all
   other credential handling.
2. Add a real circuit breaker: if a real API error suggests the
   provider's actual quota is exhausted (not just our own tracked
   count, which could drift from reality), fall back gracefully rather
   than retrying repeatedly or surfacing a raw error to users.
3. Log aggregate usage (counts only, never prompt/response content) per
   provider per day, surfaced in the admin panel built earlier, so real
   usage against real limits is visible over time.

## Part 5: UI

1. Text and image: present as genuinely available, zero-setup default
   options in the relevant dropdowns/selectors.
2. Video: present honestly as a "sometimes available" bonus, not a
   primary path — the primary supported path for video remains
   uploaded media (as it already is) or the user's own BYOK key.
3. When any shared quota is hit for the day, the fallback message
   should be calm and expected-feeling, not alarming — this is normal,
   expected behavior of a shared free resource, not an error state.

## Verification

1. Real test: generate text and image content via the shared Gemini
   pool with zero setup, confirm it works.
2. Real test: attempt video generation via the shared Veo pool if
   quota allows; if not (likely, given the real limit), confirm the
   existing upload/BYOK fallback behavior is unaffected and still works
   correctly.
3. Confirm admin panel shows real usage counts for all three.
4. Confirm graceful fallback messaging (not raw errors) when any shared
   quota is exhausted, tested by simulating exhaustion.
5. Test in Arabic for all three.

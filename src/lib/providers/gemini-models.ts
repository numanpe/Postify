import "server-only";

// Single source of truth for every hardcoded Gemini model ID this app
// calls — text (gemini-provider.ts, and the platform-held "Free AI"
// pool which reuses that same provider) and image
// (gemini-image-provider.ts). Google's fast-moving Gemini lineup has
// already forced one real production fix (gemini-2.0-flash ->
// gemini-2.5-flash -> gemini-3.6-flash, the last one a genuine prod
// outage): a NEW-USER-ONLY restriction on gemini-2.5-flash returned a
// real 404 ("no longer available to new users") for BYOK companies
// creating a fresh Google API key, even though Google's own
// deprecations page listed no shutdown date for it — the "no longer
// available to new users" state is narrower than full deprecation and
// doesn't show up there, so don't rely on that page alone next time;
// cross-check the live model/pricing docs directly.
//
// RE-VERIFY PERIODICALLY (a fast provider retirement cadence is now an
// observed, recurring risk, not hypothetical) against:
// - https://ai.google.dev/gemini-api/docs/models (current model list +
//   stable/preview/deprecated status)
// - https://ai.google.dev/gemini-api/docs/pricing (free-tier eligibility
//   — confirm the model still has a genuine $0 free tier before reusing
//   it for the platform-held pool, not just for BYOK)
// - https://ai.google.dev/gemini-api/docs/deprecations (shutdown dates
//   for whichever model is currently in use)

// gemini-3.6-flash: confirmed stable (not preview/experimental) and
// free-tier-eligible (Input/Output/context-caching all "Free of
// charge" on the free tier — ai.google.dev/gemini-api/docs/pricing,
// checked live 2026-08-31). Verified via 3 independent signals, not
// just the error message that first surfaced this: (1) Google's own
// "Model version name patterns" section on the models page uses
// gemini-3.6-flash as ITS OWN illustrative example of a stable model
// string, (2) the deprecations page lists gemini-3.6-flash as the
// recommended replacement for gemini-2.0-flash/gemini-2.0-flash-001
// (shutdown June 1, 2026) and for the gemini-2.5-flash preview variants
// that already shut down, (3) the models page describes it as
// "previous-generation Flash... balancing speed and multimodal
// capabilities across general agentic and everyday tasks" — a good fit
// for this app's script/caption/campaign-brief JSON generation, as
// opposed to gemini-3.7-flash (newest, but positioned for "complex
// coding, agentic workflows" this app doesn't need).
export const GEMINI_TEXT_MODEL = "gemini-3.6-flash";

// gemini-3.1-flash-lite-image ("Nano Banana 2 Lite"): re-confirmed live
// 2026-08-31, still current (not in the models page's "Previous
// models"/shut-down table), same $0.0336/1K-resolution-image cost, no
// free tier for any Gemini image model — unchanged from when this was
// first verified, no update needed this pass.
export const GEMINI_IMAGE_MODEL = "gemini-3.1-flash-lite-image";

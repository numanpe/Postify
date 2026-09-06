import "server-only";

import { ImageProviderError } from "@/lib/providers/image/types";
import { VoiceProviderError } from "@/lib/providers/voice/types";
import { ProviderError } from "@/lib/providers/text/types";

// Real bug found live (2026-09-07): the video studio/editor surfaced
// raw provider errors verbatim to the end user — e.g. "OpenAI: OpenAI
// rate-limited this request. Try again shortly." (the doubled "OpenAI"
// comes from prefixing the already-provider-named message with
// `${error.providerName}: `, the same pattern used throughout this
// app's other action files). CLAUDE.md's product vision is explicit
// that a user should never need to know which provider is involved —
// this app's own provider-abstraction layer exists specifically so
// that choice stays invisible. Converts a real ImageProviderError/
// VoiceProviderError into one of a small, fixed set of honest,
// provider-agnostic, actionable messages instead — matching the same
// tone this app already uses for its other honest-decline messages
// (e.g. shared-pool.ts's "Free AI is temporarily unavailable right
// now — try again shortly, or add your own key in Settings...").
// Real message CONTENT is still distinguished (a bad/rejected key
// genuinely needs the user to go fix something in Settings; a rate
// limit or network blip just needs a retry) — only the provider's own
// name and any raw technical detail are dropped, not the actionable
// guidance itself.
//
// Deliberately message-pattern-based rather than adding a structured
// "kind" field to every provider error class across the whole app
// (image/voice/text, dozens of throw sites) — every provider file
// already uses a small, consistent, deliberate set of phrases for
// these exact real failure categories (confirmed by reading every
// throw site in image/ and voice/), so matching on those phrases is
// real signal, not a fragile guess. An unrecognized shape still gets a
// genuinely honest, if generic, fallback — never a raw string.
function categorize(message: string): "needs_attention" | "transient" {
  if (/rejected the API key|no remaining balance|no quota|rejected this request/i.test(message)) {
    return "needs_attention";
  }
  return "transient";
}

export function honestImageErrorMessage(error: ImageProviderError): string {
  const category = categorize(error.message);
  return category === "needs_attention"
    ? "Your connected AI provider needs attention — check your API key or account balance in Settings, or choose a different photo/video instead."
    : "Your connected AI provider is temporarily busy — try again in a moment, or choose a different photo/video instead.";
}

export function honestVoiceErrorMessage(error: VoiceProviderError): string {
  const category = categorize(error.message);
  return category === "needs_attention"
    ? "Your connected voice provider needs attention — check your API key or account balance in Settings."
    : "Your connected voice provider is temporarily busy — try again in a moment.";
}

export function honestScriptErrorMessage(error: ProviderError): string {
  const category = categorize(error.message);
  return category === "needs_attention"
    ? "Your connected AI provider needs attention — check your API key in Settings."
    : "Your connected AI provider is temporarily busy — try again in a moment.";
}

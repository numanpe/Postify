import "server-only";

import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import type { TextProvider } from "./types";
import { TemplateTextProvider } from "./template-provider";
import { OpenAITextProvider } from "./openai-provider";
import { AnthropicTextProvider } from "./anthropic-provider";
import { GeminiTextProvider } from "./gemini-provider";
import { resolveSharedOrTemplateTextProvider } from "./shared-pool";
import { withDeletionAvoidance } from "@/lib/creative-dna/deletion-avoidance";
import { findSharedProviderCredential } from "../shared-provider-credential";

// The two-click rule: callers never choose a provider, they just ask
// for "the" provider for a company. BYOK wins when configured; the free
// template is the always-available fallback — never a silent fallback
// from a BYOK failure, only from BYOK being unconfigured in the first
// place.
export async function getTextProviderForCompany(companyId: string): Promise<TextProvider> {
  // Real bug fixed here: this used to have no provider filter at all,
  // unlike the voice/image resolvers (which correctly scope to their
  // own providers). ProviderCredential is one shared table across every
  // AiProviderKind (OPENAI/ANTHROPIC/ELEVENLABS/FISH_AUDIO) — an
  // unfiltered findFirst could pick up a voice-only credential (e.g. a
  // company that only ever saved an ElevenLabs key) and try to build a
  // text provider out of it, breaking text generation with a real
  // (not fake) 401 instead of correctly falling back to the free
  // template provider.
  // GEMINI included here on purpose: ProviderCredential is one row per
  // (company, vendor), not per capability (see its own schema comment)
  // — a Gemini key saved for the Part 2 image provider is the exact
  // same row this query can find, so it transparently covers text too
  // without the user ever entering it twice. Existing `asc` ordering
  // (oldest credential wins ties) is unchanged/pre-existing behavior,
  // not something this change should alter — it already does the right
  // thing here: a company's first-configured text-capable credential
  // keeps winning even after a later Gemini key is added for images
  // only, and a Gemini key added first (e.g. via onboarding) becomes
  // the text default same as any other provider would.
  // Company-owned credential first, then this user's opt-in shared
  // credential (Part 3 of the shared-credentials feature) — never the
  // other way around, so a company that saved its own key is never
  // silently switched onto a shared one.
  const credential =
    (await db.providerCredential.findFirst({
      where: { companyId, provider: { in: ["OPENAI", "ANTHROPIC", "GEMINI"] } },
      orderBy: { createdAt: "asc" },
    })) ?? (await findSharedProviderCredential(companyId, ["OPENAI", "ANTHROPIC", "GEMINI"], "asc"));

  // No BYOK: try the platform-held, zero-setup "Free AI" shared pool
  // first (falls back to the deterministic template per-call on any
  // failure — unconfigured, today's quota exhausted, or a transient
  // error — never a hard failure for a company that never opted into
  // anything). Real BYOK credential always wins when one exists.
  const base = credential
    ? credential.provider === "OPENAI"
      ? new OpenAITextProvider(decryptSecret(credential.encryptedKey))
      : credential.provider === "ANTHROPIC"
        ? new AnthropicTextProvider(decryptSecret(credential.encryptedKey))
        : new GeminiTextProvider(decryptSecret(credential.encryptedKey))
    : await resolveSharedOrTemplateTextProvider();

  // Every caller of this resolver automatically gets the "never
  // regenerate an exact deleted output again" rule (Part 1.1) — no
  // individual call site needs to know this exists.
  return withDeletionAvoidance(base, companyId);
}

import "server-only";

import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import type { TextProvider } from "./types";
import { TemplateTextProvider } from "./template-provider";
import { OpenAITextProvider } from "./openai-provider";
import { AnthropicTextProvider } from "./anthropic-provider";
import { withDeletionAvoidance } from "@/lib/creative-dna/deletion-avoidance";

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
  const credential = await db.providerCredential.findFirst({
    where: { companyId, provider: { in: ["OPENAI", "ANTHROPIC"] } },
    orderBy: { createdAt: "asc" },
  });

  const base = !credential
    ? new TemplateTextProvider()
    : credential.provider === "OPENAI"
      ? new OpenAITextProvider(decryptSecret(credential.encryptedKey))
      : new AnthropicTextProvider(decryptSecret(credential.encryptedKey));

  // Every caller of this resolver automatically gets the "never
  // regenerate an exact deleted output again" rule (Part 1.1) — no
  // individual call site needs to know this exists.
  return withDeletionAvoidance(base, companyId);
}

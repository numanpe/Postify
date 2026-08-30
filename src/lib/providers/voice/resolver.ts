import "server-only";

import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import type { VoiceProvider, GenerateNarrationInput, GenerateNarrationOutput } from "./types";
import { OpenAIVoiceProvider } from "./openai-voice-provider";
import { ElevenLabsVoiceProvider } from "./elevenlabs-voice-provider";
import { FishAudioVoiceProvider } from "./fish-audio-voice-provider";
import { EdgeVoiceProvider } from "./edge-voice-provider";
import { findSharedProviderCredential } from "../shared-provider-credential";
import { logProviderFallback, extractFailureReason, type FallbackInfo } from "../fallback-log";
import type { AiProviderKind, ProviderCredential, SharedProviderCredential } from "@prisma/client";

const VOICE_PROVIDERS: AiProviderKind[] = ["OPENAI", "ELEVENLABS", "FISH_AUDIO"];

function buildVoiceProvider(provider: AiProviderKind, apiKey: string): VoiceProvider {
  switch (provider) {
    case "OPENAI":
      return new OpenAIVoiceProvider(apiKey);
    case "ELEVENLABS":
      return new ElevenLabsVoiceProvider(apiKey);
    default:
      return new FishAudioVoiceProvider(apiKey);
  }
}

// Same real-failure fallback contract as the text resolver (see its own
// callWithFallback comment) — a configured BYOK voice credential that
// fails AT RUNTIME now falls through to the next saved credential, then
// to free edge-tts, rather than hard-stopping narration. The
// "opted into BYOK but never saved a key" case is unchanged — that's a
// configuration-absence error the company must actually fix (still
// returns null below), not a runtime failure to fall back from.
async function generateNarrationWithFallback(
  candidates: { label: string; provider: VoiceProvider }[],
  companyId: string,
  input: GenerateNarrationInput,
): Promise<GenerateNarrationOutput> {
  const fallbackFrom: FallbackInfo[] = [];
  for (let i = 0; i < candidates.length; i += 1) {
    const { label, provider } = candidates[i];
    try {
      const result = await provider.generateNarration(input);
      return fallbackFrom.length > 0 ? { ...result, fallbackFrom } : result;
    } catch (error) {
      const isLast = i === candidates.length - 1;
      const reason = extractFailureReason(error);
      await logProviderFallback({
        companyId,
        capability: "VOICE",
        method: "generateNarration",
        fromProvider: label,
        toProvider: isLast ? null : candidates[i + 1].label,
        reason,
      });
      fallbackFrom.push({ fromProvider: label, reason });
      if (isLast) throw error;
    }
  }
  throw new Error("Voice provider fallback chain had no candidates.");
}

// Unlike the text/image resolvers, voiceEngine is an explicit
// per-company choice, not "BYOK wins if a key exists" — voice
// generation can carry real per-call cost even when a key is already on
// file for text/image, so switching a company onto it should never
// happen silently just because a credential exists. FREE (the default)
// always succeeds — no credential needed. A company that opted into
// BYOK but hasn't saved any key yet still gets null (an explicit
// add-a-key error, unchanged) — but once at least one real credential
// exists, a runtime failure now falls through to another saved
// credential and finally to free edge-tts, instead of hard-stopping
// narration (the same deliberate philosophy change described in the
// text resolver, extended here per Part 1.2).
export async function getVoiceProviderForCompany(companyId: string): Promise<VoiceProvider | null> {
  const company = await db.company.findUnique({ where: { id: companyId }, select: { voiceEngine: true } });
  if (!company) return null;

  if (company.voiceEngine === "FREE") {
    return new EdgeVoiceProvider();
  }

  const ownCredentials: ProviderCredential[] = await db.providerCredential.findMany({
    where: { companyId, provider: { in: VOICE_PROVIDERS } },
    orderBy: { createdAt: "desc" },
  });
  const coveredProviders = new Set(ownCredentials.map((c) => c.provider));
  const remainingProviders = VOICE_PROVIDERS.filter((p) => !coveredProviders.has(p));
  const sharedCredential: SharedProviderCredential | null =
    remainingProviders.length > 0 ? await findSharedProviderCredential(companyId, remainingProviders, "desc") : null;

  const byokCredentials = [...ownCredentials, ...(sharedCredential ? [sharedCredential] : [])];
  if (byokCredentials.length === 0) return null;

  const byokCandidates = byokCredentials.map((c) => {
    const provider = buildVoiceProvider(c.provider, decryptSecret(c.encryptedKey));
    return { label: provider.name, provider };
  });
  const freeTier = new EdgeVoiceProvider();
  const candidates = [...byokCandidates, { label: freeTier.name, provider: freeTier }];

  return {
    name: candidates[0].provider.name,
    generateNarration: (input) => generateNarrationWithFallback(candidates, companyId, input),
  };
}

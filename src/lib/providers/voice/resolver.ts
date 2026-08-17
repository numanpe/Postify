import "server-only";

import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import type { VoiceProvider } from "./types";
import { OpenAIVoiceProvider } from "./openai-voice-provider";
import { ElevenLabsVoiceProvider } from "./elevenlabs-voice-provider";
import { EdgeVoiceProvider } from "./edge-voice-provider";

// Unlike the text/image resolvers, this is an explicit per-company
// choice (Company.voiceEngine), not "BYOK wins if a key exists" —
// voice generation can carry real per-call cost even when a key is
// already on file for text/image, so switching a company onto it
// should never happen silently just because a credential exists.
// FREE (the default) always succeeds — no credential needed. BYOK
// returns null when the company opted in but hasn't saved a key yet,
// same "explicit add-a-key error, not a silent fallback" contract the
// image resolver uses.
export async function getVoiceProviderForCompany(companyId: string): Promise<VoiceProvider | null> {
  const company = await db.company.findUnique({ where: { id: companyId }, select: { voiceEngine: true } });
  if (!company) return null;

  if (company.voiceEngine === "FREE") {
    return new EdgeVoiceProvider();
  }

  const credential = await db.providerCredential.findFirst({
    where: { companyId, provider: { in: ["OPENAI", "ELEVENLABS"] } },
    orderBy: { createdAt: "asc" },
  });
  if (!credential) return null;

  const apiKey = decryptSecret(credential.encryptedKey);
  return credential.provider === "OPENAI" ? new OpenAIVoiceProvider(apiKey) : new ElevenLabsVoiceProvider(apiKey);
}

import "server-only";

import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import type { VoiceProvider } from "./types";
import { OpenAIVoiceProvider } from "./openai-voice-provider";

// BYOK only — there's no free-tier VoiceProvider (see README.md). Reuses
// the same stored OpenAI credential as text/image generation.
export async function getVoiceProviderForCompany(companyId: string): Promise<VoiceProvider | null> {
  const credential = await db.providerCredential.findUnique({
    where: { companyId_provider: { companyId, provider: "OPENAI" } },
  });
  if (!credential) return null;

  const apiKey = decryptSecret(credential.encryptedKey);
  return new OpenAIVoiceProvider(apiKey);
}

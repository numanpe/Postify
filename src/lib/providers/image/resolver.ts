import "server-only";

import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import type { ImageProvider } from "./types";
import { GradientBackgroundProvider, type GradientColors } from "./gradient-provider";
import { OpenAIImageProvider } from "./openai-image-provider";

// Unlike the text resolver, this doesn't silently choose between
// providers — the caller (the poster action) already knows which
// backgroundSource the user picked. This just resolves the AI path's
// credential, reusing the same OpenAI key Settings/Phase 2 stores
// (same vendor, different endpoint). Returns null if unconfigured so
// the caller can surface an explicit "add a key in Settings" error
// instead of silently falling back to the free gradient.
export async function getAiImageProviderForCompany(companyId: string): Promise<ImageProvider | null> {
  const credential = await db.providerCredential.findUnique({
    where: { companyId_provider: { companyId, provider: "OPENAI" } },
  });
  if (!credential) return null;

  const apiKey = decryptSecret(credential.encryptedKey);
  return new OpenAIImageProvider(apiKey);
}

export function getBrandGradientProvider(colors: GradientColors): ImageProvider {
  return new GradientBackgroundProvider(colors);
}

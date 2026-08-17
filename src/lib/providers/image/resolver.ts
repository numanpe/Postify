import "server-only";

import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import type { ImageProvider } from "./types";
import { GradientBackgroundProvider, type GradientColors } from "./gradient-provider";
import { OpenAIImageProvider } from "./openai-image-provider";
import { PollinationsImageProvider } from "./pollinations-provider";

async function getOpenAiCredential(companyId: string): Promise<OpenAIImageProvider | null> {
  const credential = await db.providerCredential.findUnique({
    where: { companyId_provider: { companyId, provider: "OPENAI" } },
  });
  if (!credential) return null;

  const apiKey = decryptSecret(credential.encryptedKey);
  return new OpenAIImageProvider(apiKey);
}

// Video's AI B-roll gap-filling — unlike the text resolver, this
// doesn't silently choose between providers — the caller already knows
// which backgroundSource/scene kind was picked. Returns null if
// unconfigured so the caller (video.ts) can fall back to its existing
// real-photo-cycling behavior. Kept BYOK-only, unlike the poster
// resolver below: video generation already does a slow ffmpeg render,
// and the free image provider's 9-45s+ (sometimes longer) latency isn't
// worth risking there for a capability that already degrades
// gracefully to real footage.
export async function getAiImageProviderForCompany(companyId: string): Promise<ImageProvider | null> {
  return getOpenAiCredential(companyId);
}

// Poster's "AI Background" option — free tier via Pollinations (no key,
// open-source models) when no OpenAI key is configured, otherwise the
// company's own OpenAI key for higher/more predictable quality. Never
// returns null: "AI Background" now always works with zero setup,
// matching the free-first, BYOK-is-additive-not-required principle the
// gradient/photo backgrounds already followed.
export async function getAiImageProviderForPoster(companyId: string): Promise<ImageProvider> {
  const openAi = await getOpenAiCredential(companyId);
  return openAi ?? new PollinationsImageProvider();
}

export function getBrandGradientProvider(colors: GradientColors): ImageProvider {
  return new GradientBackgroundProvider(colors);
}

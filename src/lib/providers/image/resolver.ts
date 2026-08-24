import "server-only";

import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import type { ImageProvider } from "./types";
import { GradientBackgroundProvider, type GradientColors } from "./gradient-provider";
import { OpenAIImageProvider } from "./openai-image-provider";
import { GeminiImageProvider } from "./gemini-image-provider";
import { resolveSharedImagePool } from "./shared-image-pool";

// No explicit "which BYOK image provider is active" selector exists on
// Company — same real, pre-existing pattern the voice resolver already
// has with 3 options. `desc` breaks ties in favor of whichever was
// saved/updated most recently if a company somehow has both.
async function getByokImageCredential(companyId: string): Promise<ImageProvider | null> {
  const credential = await db.providerCredential.findFirst({
    where: { companyId, provider: { in: ["OPENAI", "GEMINI"] } },
    orderBy: { createdAt: "desc" },
  });
  if (!credential) return null;

  const apiKey = decryptSecret(credential.encryptedKey);
  switch (credential.provider) {
    case "OPENAI":
      return new OpenAIImageProvider(apiKey);
    case "GEMINI":
      return new GeminiImageProvider(apiKey);
    default:
      return null;
  }
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
  return getByokImageCredential(companyId);
}

// Poster's "AI Background" option — free tier via the platform-held
// Cloudflare Workers AI pool (FLUX.1-schnell, then SDXL, then the
// brand gradient — see shared-image-pool.ts) when no OpenAI/Gemini key
// is configured, otherwise the company's own key for higher/more
// predictable quality. Never returns null and never throws for the
// free-tier case: "AI Background" now always works with zero setup,
// matching the free-first, BYOK-is-additive-not-required principle the
// gradient/photo backgrounds already followed. Replaced Pollinations
// entirely (real, current free-tier evidence for Cloudflare vs. no
// SLA/reliability guarantee for a community-run service) rather than
// adding it as a third option — see free-ai-plan.md's Cloudflare
// investigation for why.
export async function getAiImageProviderForPoster(companyId: string, brandColors: GradientColors): Promise<ImageProvider> {
  const byok = await getByokImageCredential(companyId);
  if (byok) return byok;
  return resolveSharedImagePool(new GradientBackgroundProvider(brandColors));
}

export function getBrandGradientProvider(colors: GradientColors): ImageProvider {
  return new GradientBackgroundProvider(colors);
}

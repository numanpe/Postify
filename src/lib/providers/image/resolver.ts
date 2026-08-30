import "server-only";

import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import type { ImageProvider, GenerateBackgroundInput, GenerateBackgroundOutput } from "./types";
import { GradientBackgroundProvider, type GradientColors } from "./gradient-provider";
import { OpenAIImageProvider } from "./openai-image-provider";
import { GeminiImageProvider } from "./gemini-image-provider";
import { resolveSharedImagePool, resolveSharedImagePoolForVideo } from "./shared-image-pool";
import { findSharedProviderCredential } from "../shared-provider-credential";
import { logProviderFallback, extractFailureReason, type FallbackInfo } from "../fallback-log";
import type { AiProviderKind, ProviderCredential, SharedProviderCredential } from "@prisma/client";

const IMAGE_PROVIDERS: AiProviderKind[] = ["OPENAI", "GEMINI"];

function buildImageProvider(provider: AiProviderKind, apiKey: string): ImageProvider {
  return provider === "OPENAI" ? new OpenAIImageProvider(apiKey) : new GeminiImageProvider(apiKey);
}

// Same real-failure fallback contract as text/voice (see text/
// resolver.ts's callWithFallback comment) — every company-owned/shared
// BYOK image credential is tried in order before falling through to
// whatever terminal candidate the caller supplied (shared Cloudflare
// pool for posters, nothing further for video's B-roll — see below).
async function generateBackgroundWithFallback(
  candidates: { label: string; provider: ImageProvider }[],
  companyId: string,
  input: GenerateBackgroundInput,
): Promise<GenerateBackgroundOutput> {
  const fallbackFrom: FallbackInfo[] = [];
  for (let i = 0; i < candidates.length; i += 1) {
    const { label, provider } = candidates[i];
    try {
      const result = await provider.generateBackground(input);
      return fallbackFrom.length > 0 ? { ...result, fallbackFrom } : result;
    } catch (error) {
      const isLast = i === candidates.length - 1;
      const reason = extractFailureReason(error);
      await logProviderFallback({
        companyId,
        capability: "IMAGE",
        method: "generateBackground",
        fromProvider: label,
        toProvider: isLast ? null : candidates[i + 1].label,
        reason,
      });
      fallbackFrom.push({ fromProvider: label, reason });
      if (isLast) throw error;
    }
  }
  throw new Error("Image provider fallback chain had no candidates.");
}

// No explicit "which BYOK image provider is active" selector exists on
// Company — same real, pre-existing pattern the voice resolver already
// has. Returns EVERY real candidate (company-owned credentials in their
// existing tie-break order, then the shared credential for any
// provider the company hasn't already configured its own key for) so a
// runtime failure on one can fall through to another, not just the
// single most-recent one as before.
async function getByokImageCandidates(companyId: string): Promise<{ label: string; provider: ImageProvider }[]> {
  const ownCredentials: ProviderCredential[] = await db.providerCredential.findMany({
    where: { companyId, provider: { in: IMAGE_PROVIDERS } },
    orderBy: { createdAt: "desc" },
  });
  const coveredProviders = new Set(ownCredentials.map((c) => c.provider));
  const remainingProviders = IMAGE_PROVIDERS.filter((p) => !coveredProviders.has(p));
  const sharedCredential: SharedProviderCredential | null =
    remainingProviders.length > 0 ? await findSharedProviderCredential(companyId, remainingProviders, "desc") : null;

  return [...ownCredentials, ...(sharedCredential ? [sharedCredential] : [])].map((c) => {
    const provider = buildImageProvider(c.provider, decryptSecret(c.encryptedKey));
    return { label: provider.name, provider };
  });
}

// Video's AI B-roll gap-filling — unlike the text resolver, this
// doesn't silently choose between providers — the caller already knows
// which backgroundSource/scene kind was picked. Returns null if nothing
// is configured/available at all so the caller (video.ts, scene-
// editor.ts) can fall back to its existing real-footage-cycling
// behavior, or fail honestly.
//
// `source` is a hint for the caller's shared-quota bookkeeping
// (MAX_FREE_AI_STILLS_PER_VIDEO only applies to the shared pool, never
// to a company's own uncapped BYOK quota) — it reflects which tier is
// PREFERRED, not a guarantee of which tier a given call actually used,
// since a BYOK failure can now fall through to the shared pool
// mid-generation. Callers must check each individual result's
// providerName (via IMAGE_SHARED_POOL_NAME) to know which tier a
// specific image actually came from — see video/generate.ts.
export async function getAiImageProviderForCompany(
  companyId: string,
): Promise<{ provider: ImageProvider; source: "BYOK" | "SHARED_POOL" } | null> {
  const byokCandidates = await getByokImageCandidates(companyId);
  const shared = await resolveSharedImagePoolForVideo();

  const candidates = [...byokCandidates, ...(shared ? [{ label: shared.name, provider: shared }] : [])];
  if (candidates.length === 0) return null;

  const provider: ImageProvider = {
    name: candidates[0].provider.name,
    generateBackground: (input) => generateBackgroundWithFallback(candidates, companyId, input),
  };
  return { provider, source: byokCandidates.length > 0 ? "BYOK" : "SHARED_POOL" };
}

// Poster's "AI Background" option — free tier via the platform-held
// Cloudflare Workers AI pool (FLUX.1-schnell, then SDXL, then the brand
// gradient — see shared-image-pool.ts) when no OpenAI/Gemini key is
// configured, otherwise the company's own key(s) for higher/more
// predictable quality. Never returns null and never throws for the
// free-tier case: "AI Background" now always works with zero setup.
// resolveSharedImagePool's own returned provider never throws either
// (it's the guaranteed-terminal gradient fallback), so it's always safe
// as the last candidate here.
export async function getAiImageProviderForPoster(companyId: string, brandColors: GradientColors): Promise<ImageProvider> {
  const byokCandidates = await getByokImageCandidates(companyId);
  const freeTier = await resolveSharedImagePool(new GradientBackgroundProvider(brandColors));
  const candidates = [...byokCandidates, { label: freeTier.name, provider: freeTier }];

  return {
    name: candidates[0].provider.name,
    generateBackground: (input) => generateBackgroundWithFallback(candidates, companyId, input),
  };
}

export function getBrandGradientProvider(colors: GradientColors): ImageProvider {
  return new GradientBackgroundProvider(colors);
}

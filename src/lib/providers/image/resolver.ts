import "server-only";

import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import type { ImageProvider } from "./types";
import { GradientBackgroundProvider, type GradientColors } from "./gradient-provider";
import { OpenAIImageProvider } from "./openai-image-provider";
import { GeminiImageProvider } from "./gemini-image-provider";
import { resolveSharedImagePool, resolveSharedImagePoolForVideo } from "./shared-image-pool";
import { findSharedProviderCredential } from "../shared-provider-credential";

// No explicit "which BYOK image provider is active" selector exists on
// Company — same real, pre-existing pattern the voice resolver already
// has with 3 options. `desc` breaks ties in favor of whichever was
// saved/updated most recently if a company somehow has both.
async function getByokImageCredential(companyId: string): Promise<ImageProvider | null> {
  // Company-owned credential first, then this user's opt-in shared
  // credential — same priority order every resolver uses.
  const credential =
    (await db.providerCredential.findFirst({
      where: { companyId, provider: { in: ["OPENAI", "GEMINI"] } },
      orderBy: { createdAt: "desc" },
    })) ?? (await findSharedProviderCredential(companyId, ["OPENAI", "GEMINI"], "desc"));
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
// unconfigured/exhausted so the caller (video.ts, scene-editor.ts) can
// fall back to its existing real-footage-cycling behavior, or fail
// honestly.
//
// Was BYOK-only until 2026-08-24 (video's slow ffmpeg render made the
// free pool's 9-45s+ per-call latency feel too risky, and it already
// degraded gracefully to real footage) — but that left companies with
// zero real media AND no BYOK key fully blocked, unlike posters, which
// always have a working zero-setup path. Now falls back to the same
// shared Cloudflare pool posters use. `source` tells the caller which
// one it got: BYOK is the company's own key/quota (uncapped, same as
// everywhere else), SHARED_POOL is the platform's shared daily quota
// (the caller must bound how many fresh calls a single video makes —
// see MAX_FREE_AI_STILLS_PER_VIDEO in generate.ts — since one video can
// need several B-roll stills where a poster only ever needs one).
export async function getAiImageProviderForCompany(
  companyId: string,
): Promise<{ provider: ImageProvider; source: "BYOK" | "SHARED_POOL" } | null> {
  const byok = await getByokImageCredential(companyId);
  if (byok) return { provider: byok, source: "BYOK" };
  const shared = await resolveSharedImagePoolForVideo();
  if (shared) return { provider: shared, source: "SHARED_POOL" };
  return null;
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

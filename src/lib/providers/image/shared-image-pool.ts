import "server-only";

import { db } from "@/lib/db";
import type { ImageProvider, GenerateBackgroundInput, GenerateBackgroundOutput } from "./types";
import { ImageProviderError } from "./types";
import {
  CloudflareFluxImageProvider,
  CloudflareSdxlImageProvider,
  CloudflareQuotaExhaustedError,
} from "./cloudflare-image-provider";

const SHARED_POOL_PROVIDER = "CLOUDFLARE" as const;

// Matches CloudflareFluxImageProvider/CloudflareSdxlImageProvider's own
// `name` field — exported so callers (image/resolver.ts,
// video/generate.ts) can recognize "this result actually came from the
// shared pool" from a GenerateBackgroundOutput.providerName without
// hardcoding the string twice.
export const IMAGE_SHARED_POOL_NAME = "Free AI";

function todayUtcDateOnly(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function getPlatformCloudflareCredentials(): { accountId: string; apiToken: string } | null {
  const accountId = process.env.PLATFORM_CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.PLATFORM_CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken) return null;
  return { accountId, apiToken };
}

async function isSharedImagePoolExhaustedToday(): Promise<boolean> {
  const row = await db.sharedAiUsage.findUnique({
    where: { provider_date: { provider: SHARED_POOL_PROVIDER, date: todayUtcDateOnly() } },
  });
  return Boolean(row?.exhaustedAt);
}

async function recordSharedImagePoolSuccess(): Promise<void> {
  const date = todayUtcDateOnly();
  await db.sharedAiUsage.upsert({
    where: { provider_date: { provider: SHARED_POOL_PROVIDER, date } },
    create: { provider: SHARED_POOL_PROVIDER, date, successCount: 1 },
    update: { successCount: { increment: 1 } },
  });
}

async function recordSharedImagePoolExhaustion(): Promise<void> {
  const date = todayUtcDateOnly();
  const updated = await db.sharedAiUsage.updateMany({
    where: { provider: SHARED_POOL_PROVIDER, date, exhaustedAt: null },
    data: { exhaustedAt: new Date() },
  });
  if (updated.count === 0) {
    await db.sharedAiUsage.upsert({
      where: { provider_date: { provider: SHARED_POOL_PROVIDER, date } },
      create: { provider: SHARED_POOL_PROVIDER, date, exhaustedAt: new Date() },
      update: {},
    });
  }
}

// For the calm /studio-style notice pattern (see
// src/lib/providers/text/shared-pool.ts's equivalent) — surfaced from
// the poster form if this app later wants an equivalent proactive
// banner for images; not wired into any UI yet, matching Part 1's
// text-only UI scope so far, but the same real signal is ready to use.
export async function shouldShowImagePoolExhaustedNotice(): Promise<boolean> {
  if (!getPlatformCloudflareCredentials()) return false;
  return isSharedImagePoolExhaustedToday();
}

// The free-tier resolver (getAiImageProviderForPoster in resolver.ts)
// calls this only when a company has no BYOK image credential. Tries
// FLUX.1-schnell first (the durable baseline — real metered cost, not
// SDXL's beta-priced $0.00/step), then SDXL (real width/height control,
// and a genuinely separate model that may have its own headroom even
// when FLUX alone hits a real 429), then finally the brand gradient —
// which, unlike Pollinations before it, this wrapper guarantees is
// reached on ANY failure (network, exhaustion, malformed response), so
// generatePosterCore() never needs to special-case "which provider
// failed" the way it correctly still does for a real BYOK failure.
export async function resolveSharedImagePool(gradientFallback: ImageProvider): Promise<ImageProvider> {
  const credentials = getPlatformCloudflareCredentials();
  if (!credentials) {
    // Real, server-side-only visibility into why the zero-setup pool
    // silently isn't running — the free-tier caller never sees this
    // (falls to the gradient exactly the same as any other reason),
    // but an operator checking real logs shouldn't have to guess
    // between "not configured" and "configured but genuinely failing".
    console.warn("[shared-image-pool] PLATFORM_CLOUDFLARE_ACCOUNT_ID/API_TOKEN not set — falling back to gradient.");
    return gradientFallback;
  }
  if (await isSharedImagePoolExhaustedToday()) {
    return gradientFallback;
  }

  const flux = new CloudflareFluxImageProvider(credentials.accountId, credentials.apiToken);
  const sdxl = new CloudflareSdxlImageProvider(credentials.accountId, credentials.apiToken);

  return {
    name: flux.name,
    async generateBackground(input: GenerateBackgroundInput): Promise<GenerateBackgroundOutput> {
      for (const provider of [flux, sdxl]) {
        try {
          const result = await provider.generateBackground(input);
          await recordSharedImagePoolSuccess();
          return result;
        } catch (error) {
          if (error instanceof CloudflareQuotaExhaustedError) {
            await recordSharedImagePoolExhaustion();
            // The real 10,000-neuron budget is account-wide, not
            // per-model (confirmed via Cloudflare's own docs) — once
            // FLUX genuinely hits it, trying SDXL next would almost
            // certainly just spend a second request on the same
            // known-exhausted result. Skip straight to the gradient
            // rather than wasting it.
            break;
          }
          // Any other failure (network, capacity-code 3040, malformed
          // response) — real, but not necessarily shared across both
          // models (3040 in particular is a transient per-request
          // routing issue), so still worth trying the next model.
          // Logged server-side (never surfaced to the free-tier caller,
          // same as the missing-credentials case above) — this path was
          // previously completely silent, which made a real production
          // issue (every generation quietly falling back to the
          // gradient) impossible to diagnose from logs alone.
          console.warn(`[shared-image-pool] ${provider.name} failed, trying next option:`, error);
        }
      }
      return gradientFallback.generateBackground(input);
    },
  };
}

// Video's zero-setup AI B-roll fallback — real, was never wired in
// until this point (video generation launched BYOK-only; see the
// removed comment in resolver.ts for the original latency reasoning).
// Deliberately NOT built on resolveSharedImagePool above: that
// wrapper's job is to guarantee an always-succeeds ImageProvider by
// falling back to a brand gradient on any failure, which is right for
// a poster background but wrong for a video scene — a gradient card
// standing in for real B-roll is exactly the "slideshow-quality"
// output CLAUDE.md's video pipeline explicitly fails. This version
// throws a real error on total failure instead, so the caller
// (generate.ts) can fall back to its own real-footage-cycling logic,
// or fail the generation honestly, the same way a BYOK failure already
// does — never silently swaps in a flat color card.
export async function resolveSharedImagePoolForVideo(): Promise<ImageProvider | null> {
  const credentials = getPlatformCloudflareCredentials();
  if (!credentials) return null;
  if (await isSharedImagePoolExhaustedToday()) return null;

  const flux = new CloudflareFluxImageProvider(credentials.accountId, credentials.apiToken);
  const sdxl = new CloudflareSdxlImageProvider(credentials.accountId, credentials.apiToken);

  return {
    name: flux.name,
    async generateBackground(input: GenerateBackgroundInput): Promise<GenerateBackgroundOutput> {
      for (const provider of [flux, sdxl]) {
        try {
          const result = await provider.generateBackground(input);
          await recordSharedImagePoolSuccess();
          return result;
        } catch (error) {
          if (error instanceof CloudflareQuotaExhaustedError) {
            await recordSharedImagePoolExhaustion();
            break;
          }
          console.warn(`[shared-image-pool:video] ${provider.name} failed, trying next option:`, error);
        }
      }
      throw new ImageProviderError(flux.name, "Free AI visuals are temporarily unavailable — today's shared quota may be used up.");
    },
  };
}

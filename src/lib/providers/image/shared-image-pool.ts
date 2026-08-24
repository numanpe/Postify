import "server-only";

import { db } from "@/lib/db";
import type { ImageProvider, GenerateBackgroundInput, GenerateBackgroundOutput } from "./types";
import {
  CloudflareFluxImageProvider,
  CloudflareSdxlImageProvider,
  CloudflareQuotaExhaustedError,
} from "./cloudflare-image-provider";

const SHARED_POOL_PROVIDER = "CLOUDFLARE" as const;

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
  if (!credentials || (await isSharedImagePoolExhaustedToday())) {
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
        }
      }
      return gradientFallback.generateBackground(input);
    },
  };
}

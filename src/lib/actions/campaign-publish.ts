"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requireCompany } from "@/lib/session";
import { getAggregatorAdapter } from "@/lib/providers/aggregator/resolver";
import { AggregatorProviderError } from "@/lib/providers/aggregator/types";
import { storage } from "@/lib/storage";
import { cleanupMediaStorage } from "@/lib/storage-cleanup";
import { processSinglePublishJob } from "@/lib/jobs/process-publish-jobs";

async function requireOwnedCampaignItemWithAssets(itemId: string, companyId: string) {
  const item = await db.campaignItem.findFirst({
    where: { id: itemId, campaign: { companyId } },
    include: {
      campaign: true,
      poster: { include: { asset: true } },
      video: { include: { asset: true } },
    },
  });
  if (!item) {
    throw new Error("Campaign item not found.");
  }
  return item;
}

// Same casing translation for every future real aggregator adapter — kept
// here rather than per-adapter since it's about *this app's* platform
// enum, not any one provider's wire format specifically.
const ZERNIO_PLATFORM_NAMES: Partial<Record<string, string>> = {
  FACEBOOK: "facebook",
  INSTAGRAM: "instagram",
};

// Option 2 on a campaign card: "Publish via Selected Provider". A single
// synchronous BYOK call, not a scheduled job — see AggregatorPublishLog's
// doc comment for why this doesn't use a retry queue. Never throws back
// to the caller: outcome (success or failure) is written to the audit
// log and the card re-reads it after revalidation, matching how this
// card already surfaces CampaignItem.errorMessage.
export async function publishCampaignItemViaAggregator(itemId: string): Promise<void> {
  const { company } = await requireCompany();
  const item = await requireOwnedCampaignItemWithAssets(itemId, company.id);

  const mediaAsset = item.poster?.asset ?? item.video?.asset;
  const mediaKind = item.poster ? "image" : "video";

  const logResult = async (succeeded: boolean, externalPostId?: string, errorMessage?: string) => {
    await db.aggregatorPublishLog.create({
      data: {
        companyId: company.id,
        campaignItemId: item.id,
        provider: company.selectedAggregator ?? "ZERNIO",
        succeeded,
        externalPostId,
        errorMessage,
      },
    });
  };

  try {
    if (!mediaAsset) {
      throw new Error("This item hasn't finished generating yet.");
    }
    if (mediaAsset.storageDeletedAt) {
      throw new Error("This file was already cleaned up after a previous successful publish.");
    }
    if (!company.selectedAggregator) {
      throw new Error("No publishing provider selected — choose one in Settings.");
    }

    const credential = await db.aggregatorCredential.findUnique({
      where: { companyId_provider: { companyId: company.id, provider: company.selectedAggregator } },
    });
    if (!credential) {
      throw new Error("No API key saved for the selected provider — add one in Settings.");
    }

    const accountMap = credential.accountMap as Record<string, string>;
    const platforms = item.targetPlatforms
      .map((platform) => {
        const accountId = accountMap[platform];
        const providerPlatformName =
          company.selectedAggregator === "ZERNIO" ? ZERNIO_PLATFORM_NAMES[platform] : platform.toLowerCase();
        return accountId && providerPlatformName ? { platform: providerPlatformName, accountId } : null;
      })
      .filter((p): p is { platform: string; accountId: string } => p !== null);

    if (platforms.length === 0) {
      throw new Error("No account IDs configured in Settings for this item's target platforms.");
    }

    const adapter = getAggregatorAdapter(credential);
    const mediaBuffer = await storage.get(mediaAsset.storageKey);

    const result = await adapter.publishPost({
      mediaAssetId: mediaAsset.id,
      mediaBuffer,
      mediaMimeType: mediaAsset.mimeType,
      mediaKind,
      captionText: item.captionText ?? item.angle,
      hashtags: item.hashtags,
      platforms,
    });

    await logResult(true, result.externalPostId);
    // Strict trigger guarantee: cleanup only runs here, after a real,
    // awaited, successful publish response — never from the download path.
    await cleanupMediaStorage(mediaAsset.id);
  } catch (error) {
    const message =
      error instanceof AggregatorProviderError || error instanceof Error ? error.message : "Unknown error.";
    await logResult(false, undefined, message);
  }

  revalidatePath(`/campaigns/${item.campaignId}`);
}

// Option 3 on a campaign card: "Direct API Publish (Advanced Native)".
// Reuses the app's existing, real Meta Graph API machinery
// (PublishJob/SocialAccount) rather than a parallel implementation.
// Poster items only — the existing SocialProvider adapters
// (facebook-page-provider.ts/instagram-provider.ts) only implement photo
// publishing, so a video item here would be fake functionality; the UI
// only renders this button for posters.
export async function publishCampaignItemDirect(itemId: string, formData: FormData): Promise<void> {
  const { company } = await requireCompany();
  const item = await requireOwnedCampaignItemWithAssets(itemId, company.id);

  if (!item.poster) return;

  const socialAccountId = formData.get("socialAccountId");
  if (typeof socialAccountId !== "string") return;

  const account = await db.socialAccount.findFirst({ where: { id: socialAccountId, companyId: company.id } });
  if (!account) return;

  const job = await db.publishJob.create({
    data: {
      companyId: company.id,
      socialAccountId: account.id,
      posterId: item.poster.id,
      caption: item.captionText ?? item.angle,
      status: "SCHEDULED",
      scheduledFor: new Date(),
      nextAttemptAt: new Date(),
    },
    include: { socialAccount: true, poster: { include: { asset: true } } },
  });

  const succeeded = await processSinglePublishJob(job);
  if (succeeded) {
    // Strict trigger guarantee: only after processSinglePublishJob's
    // awaited result confirms PUBLISHED — see its own return-true path.
    await cleanupMediaStorage(item.poster.asset.id);
  }

  revalidatePath(`/campaigns/${item.campaignId}`);
  revalidatePath("/publish");
}

// "Extend retention" on a stale-flagged card — restarts the retention
// cron's age countdown without touching the file or publish state.
export async function extendMediaRetention(assetId: string, campaignId: string): Promise<void> {
  const { company } = await requireCompany();

  await db.mediaAsset.updateMany({
    where: { id: assetId, companyId: company.id },
    data: { retentionExtendedAt: new Date(), staleFlaggedAt: null },
  });

  revalidatePath(`/campaigns/${campaignId}`);
}

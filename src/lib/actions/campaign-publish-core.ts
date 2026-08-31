import "server-only";

import type { Company } from "@prisma/client";

import { db } from "@/lib/db";
import { getAggregatorAdapter } from "@/lib/providers/aggregator/resolver";
import { AggregatorProviderError } from "@/lib/providers/aggregator/types";
import { storage } from "@/lib/storage";
import { cleanupMediaStorage } from "@/lib/storage-cleanup";
import { processSinglePublishJob } from "@/lib/jobs/process-publish-jobs";

// The real, session-free logic behind campaign-publish.ts's two publish
// actions — extracted so a background job (process-recurring-plans.ts's
// auto-publish step) can call the exact same real publish logic a user's
// own button click uses, without a request session to call
// requireCompany() against. Same reasoning process-publish-jobs.ts
// already used to split processSinglePublishJob out of
// processPublishJobs. campaign-publish.ts's exported actions are now
// thin requireCompany() + delegate wrappers around these — zero
// behavior change for the existing UI.

const STALE_PUBLISH_LOCK_MINUTES = 5;

const ZERNIO_PLATFORM_NAMES: Partial<Record<string, string>> = {
  FACEBOOK: "facebook",
  INSTAGRAM: "instagram",
};

export async function requireOwnedCampaignItemWithAssets(itemId: string, companyId: string) {
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

type OwnedCampaignItem = Awaited<ReturnType<typeof requireOwnedCampaignItemWithAssets>>;

export async function publishCampaignItemViaAggregatorForCompany(
  item: OwnedCampaignItem,
  company: Company,
): Promise<void> {
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

  let lockAcquired = false;
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

    const staleLockThreshold = new Date(Date.now() - STALE_PUBLISH_LOCK_MINUTES * 60 * 1000);
    const claim = await db.campaignItem.updateMany({
      where: {
        id: item.id,
        OR: [{ publishingLockedAt: null }, { publishingLockedAt: { lt: staleLockThreshold } }],
      },
      data: { publishingLockedAt: new Date() },
    });
    if (claim.count === 0) {
      throw new Error("This item is already being published — please wait for it to finish.");
    }
    lockAcquired = true;

    const credential = await db.aggregatorCredential.findUnique({
      where: { companyId_provider: { companyId: company.id, provider: company.selectedAggregator } },
    });
    if (!credential) {
      throw new Error("No API key saved for the selected provider — add one in Settings.");
    }

    const accountMap = credential.accountMap as Record<string, string>;
    const isUploadPost = company.selectedAggregator === "UPLOAD_POST";
    const platforms = item.targetPlatforms
      .map((platform) => {
        const providerPlatformName =
          company.selectedAggregator === "ZERNIO" ? ZERNIO_PLATFORM_NAMES[platform] : platform.toLowerCase();
        if (!providerPlatformName) return null;
        if (isUploadPost) return { platform: providerPlatformName, accountId: "" };
        const accountId = accountMap[platform];
        return accountId ? { platform: providerPlatformName, accountId } : null;
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
      profileHint: accountMap["_PROFILE_"],
    });

    await logResult(true, result.externalPostId);
    await cleanupMediaStorage(mediaAsset.id);
  } catch (error) {
    const message =
      error instanceof AggregatorProviderError || error instanceof Error ? error.message : "Unknown error.";
    await logResult(false, undefined, message);
  } finally {
    if (lockAcquired) {
      await db.campaignItem.update({ where: { id: item.id }, data: { publishingLockedAt: null } });
    }
  }
}

export async function publishCampaignItemDirectForCompany(
  item: OwnedCampaignItem,
  company: Company,
  socialAccountId: string,
): Promise<void> {
  if (!item.poster) return;

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
    include: {
      socialAccount: true,
      poster: { include: { asset: true, campaignItem: { include: { campaign: true } } } },
      video: { include: { asset: true, campaignItem: { include: { campaign: true } } } },
    },
  });

  const outcome = await processSinglePublishJob(job);
  if (outcome === "succeeded") {
    await cleanupMediaStorage(item.poster.asset.id);
  }
}

import "server-only";

import type { Company, MediaAsset, SocialPlatform } from "@prisma/client";

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

interface AggregatorPublishAttempt {
  mediaAsset: MediaAsset;
  mediaKind: "image" | "video";
  captionText: string;
  hashtags: string[];
  targetPlatforms: SocialPlatform[];
  // Passed straight through to the adapter — every real aggregator
  // adapter (Zernio/Buffer/PostProxy/Upload-Post) already accepts this
  // and hands it to the aggregator's own API, which does the actual
  // waiting on its own infrastructure. No new job/cron needed on our
  // side for a scheduled aggregator post — unlike the Direct/PublishJob
  // path, which does need our own cron since Meta's Graph API has no
  // native "publish later" of its own.
  scheduledTime?: Date;
  company: Company;
}

interface AggregatorPublishResult {
  succeeded: boolean;
  externalPostId?: string;
  errorMessage?: string;
}

// The real "resolve platforms, call the adapter" logic shared by both
// the CampaignItem path (unchanged, existing) and the standalone
// Poster/Video path (Media Library's Share button, 2026-09-02) below —
// callers own locking and audit logging, since those differ by what
// they're publishing (a CampaignItem vs a bare Poster/Video with no
// CampaignItem in the picture).
async function attemptAggregatorPublish(attempt: AggregatorPublishAttempt): Promise<AggregatorPublishResult> {
  const { mediaAsset, mediaKind, captionText, hashtags, targetPlatforms, scheduledTime, company } = attempt;

  if (mediaAsset.storageDeletedAt) {
    return { succeeded: false, errorMessage: "This file was already cleaned up after a previous successful publish." };
  }
  if (!company.selectedAggregator) {
    return { succeeded: false, errorMessage: "No publishing provider selected — choose one in Settings." };
  }

  const credential = await db.aggregatorCredential.findUnique({
    where: { companyId_provider: { companyId: company.id, provider: company.selectedAggregator } },
  });
  if (!credential) {
    return { succeeded: false, errorMessage: "No API key saved for the selected provider — add one in Settings." };
  }

  const accountMap = credential.accountMap as Record<string, string>;
  const isUploadPost = company.selectedAggregator === "UPLOAD_POST";
  const platforms = targetPlatforms
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
    return { succeeded: false, errorMessage: "No account IDs configured in Settings for this item's target platforms." };
  }

  try {
    const adapter = getAggregatorAdapter(credential);
    const mediaBuffer = await storage.get(mediaAsset.storageKey);

    const result = await adapter.publishPost({
      mediaAssetId: mediaAsset.id,
      mediaBuffer,
      mediaMimeType: mediaAsset.mimeType,
      mediaKind,
      captionText,
      hashtags,
      platforms,
      scheduledTime,
      profileHint: accountMap["_PROFILE_"],
    });

    // The aggregator already has its own copy of the media bytes as of
    // this call (mediaBuffer was sent in the request above) even for a
    // future scheduledTime — safe to clean up our own copy now either
    // way, same as an immediate publish already did.
    await cleanupMediaStorage(mediaAsset.id);
    return { succeeded: true, externalPostId: result.externalPostId };
  } catch (error) {
    const message =
      error instanceof AggregatorProviderError || error instanceof Error ? error.message : "Unknown error.";
    return { succeeded: false, errorMessage: message };
  }
}

export async function publishCampaignItemViaAggregatorForCompany(
  item: OwnedCampaignItem,
  company: Company,
): Promise<void> {
  const mediaAsset = item.poster?.asset ?? item.video?.asset;
  const mediaKind = item.poster ? "image" : "video";

  const logResult = (succeeded: boolean, externalPostId?: string, errorMessage?: string) =>
    db.aggregatorPublishLog.create({
      data: {
        companyId: company.id,
        campaignItemId: item.id,
        provider: company.selectedAggregator ?? "ZERNIO",
        succeeded,
        externalPostId,
        errorMessage,
      },
    });

  if (!mediaAsset) {
    await logResult(false, undefined, "This item hasn't finished generating yet.");
    return;
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
    await logResult(false, undefined, "This item is already being published — please wait for it to finish.");
    return;
  }

  try {
    const result = await attemptAggregatorPublish({
      mediaAsset,
      mediaKind,
      captionText: item.captionText ?? item.angle,
      hashtags: item.hashtags,
      targetPlatforms: item.targetPlatforms,
      company,
    });
    await logResult(result.succeeded, result.externalPostId, result.errorMessage);
  } finally {
    await db.campaignItem.update({ where: { id: item.id }, data: { publishingLockedAt: null } });
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

export interface StandaloneAggregatorPublishInput {
  company: Company;
  posterId?: string;
  videoId?: string;
  captionText: string;
  hashtags: string[];
  targetPlatforms: SocialPlatform[];
  scheduledTime?: Date;
}

// Media Library's "Share" button (2026-09-02) — the same real
// attemptAggregatorPublish core as the CampaignItem path above, but for
// a bare Poster/Video with no CampaignItem in the picture (a Studio-
// generated standalone item, or reached straight from the library
// rather than a campaign card). No AggregatorPublishLog entry is
// written here — that table's own doc comment scopes it to campaign-
// card attempts specifically, and widening it to a nullable
// campaignItemId would ripple into every existing read of that table
// (Media page's own Recent Activity feed included). The real, honest
// tradeoff: this path's result is only surfaced as an immediate
// in-request confirmation to the caller, not a persisted history row —
// a real gap (Media-Library-originated aggregator publishes won't show
// in Recent Activity) flagged, not hidden.
export async function publishStandaloneAssetViaAggregatorForCompany(
  input: StandaloneAggregatorPublishInput,
): Promise<AggregatorPublishResult> {
  const { company, posterId, videoId, captionText, hashtags, targetPlatforms, scheduledTime } = input;

  const [poster, video] = await Promise.all([
    posterId ? db.poster.findFirst({ where: { id: posterId, companyId: company.id }, include: { asset: true } }) : null,
    videoId ? db.video.findFirst({ where: { id: videoId, companyId: company.id }, include: { asset: true } }) : null,
  ]);
  const mediaAsset = poster?.asset ?? video?.asset;
  const mediaKind: "image" | "video" = poster ? "image" : "video";

  if (!mediaAsset) {
    return { succeeded: false, errorMessage: "That poster or video no longer exists." };
  }

  const staleLockThreshold = new Date(Date.now() - STALE_PUBLISH_LOCK_MINUTES * 60 * 1000);
  const lockGuard = { OR: [{ publishingLockedAt: null }, { publishingLockedAt: { lt: staleLockThreshold } }] };
  const claim = poster
    ? await db.poster.updateMany({ where: { id: poster.id, ...lockGuard }, data: { publishingLockedAt: new Date() } })
    : await db.video.updateMany({ where: { id: video!.id, ...lockGuard }, data: { publishingLockedAt: new Date() } });
  if (claim.count === 0) {
    return { succeeded: false, errorMessage: "This item is already being published — please wait for it to finish." };
  }

  try {
    return await attemptAggregatorPublish({
      mediaAsset,
      mediaKind,
      captionText,
      hashtags,
      targetPlatforms,
      scheduledTime,
      company,
    });
  } finally {
    if (poster) {
      await db.poster.update({ where: { id: poster.id }, data: { publishingLockedAt: null } });
    } else if (video) {
      await db.video.update({ where: { id: video.id }, data: { publishingLockedAt: null } });
    }
  }
}

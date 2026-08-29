import "server-only";

import type { Poster, PublishJob, SocialAccount, MediaAsset, Video, CampaignItem, Campaign } from "@prisma/client";

import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { createPublicAssetLink, revokePublicAssetLinksForAsset } from "@/lib/public-asset-links";
import { getSocialProvider } from "@/lib/providers/social/resolver";
import { recordSignal, SIGNAL_STRENGTH } from "@/lib/creative-dna/signals";
import { recomputeCreativeDnaPreferences } from "@/lib/creative-dna/aggregate";

const MAX_RETRIES = 3;
const BASE_BACKOFF_SEC = 60;
// A job stuck in PUBLISHING this long (e.g. the process was killed
// mid-call) is treated as abandoned and picked up again — same reasoning
// as process-campaign-items.ts's STALE_GENERATING_MINUTES.
const STALE_PUBLISHING_MINUTES = 5;

export interface ProcessResult {
  processedCount: number;
  succeededCount: number;
  failedCount: number;
}

type CampaignItemWithCampaign = CampaignItem & { campaign: Campaign };
type DueJob = PublishJob & {
  socialAccount: SocialAccount;
  poster: (Poster & { asset: MediaAsset; campaignItem: CampaignItemWithCampaign | null }) | null;
  video: (Video & { asset: MediaAsset; campaignItem: CampaignItemWithCampaign | null }) | null;
};

// Retry/backoff bookkeeping mirrors process-campaign-items.ts. DRAFT jobs
// are never picked up here — only SCHEDULED (queued, due) ones — a job
// only becomes eligible once src/lib/actions/publish.ts explicitly
// schedules it.
export async function processPublishJobs(batchSize = 3): Promise<ProcessResult> {
  const staleThreshold = new Date(Date.now() - STALE_PUBLISHING_MINUTES * 60 * 1000);

  const dueJobs = await db.publishJob.findMany({
    where: {
      nextAttemptAt: { lte: new Date() },
      OR: [
        { status: "SCHEDULED" },
        { status: "FAILED", retryCount: { lt: MAX_RETRIES } },
        { status: "PUBLISHING", updatedAt: { lt: staleThreshold } },
      ],
    },
    include: {
      socialAccount: true,
      poster: { include: { asset: true, campaignItem: { include: { campaign: true } } } },
      video: { include: { asset: true, campaignItem: { include: { campaign: true } } } },
    },
    orderBy: { nextAttemptAt: "asc" },
    take: batchSize,
  });

  let succeededCount = 0;
  let failedCount = 0;

  for (const job of dueJobs) {
    const outcome = await processSinglePublishJob(job);
    if (outcome === "succeeded") succeededCount += 1;
    else if (outcome === "failed") failedCount += 1;
    // "skipped" (another concurrent caller already claimed this job)
    // counts toward neither.
  }

  return { processedCount: dueJobs.length, succeededCount, failedCount };
}

export type PublishJobOutcome = "succeeded" | "failed" | "skipped";

// Extracted so a single explicit publish attempt (the campaign card's
// "Direct API Publish" button — src/lib/actions/campaign-publish.ts) can
// await exactly one job's real outcome instead of a batch call that
// might process a different, unrelated due job first — same reasoning as
// processSingleCampaignItem in process-campaign-items.ts. Returns an
// outcome rather than throwing so callers can decide what to do next
// (e.g. only run cleanupMediaStorage on a real "succeeded").
export async function processSinglePublishJob(job: DueJob): Promise<PublishJobOutcome> {
  // Compare-and-swap on the exact status this job had when fetched — a
  // plain update() here means two overlapping callers (a stale-recovery
  // batch run and a real-time "Direct API Publish" click, say) could both
  // claim the same job and both post it live to the social platform.
  const claim = await db.publishJob.updateMany({
    where: { id: job.id, status: job.status },
    data: { status: "PUBLISHING" },
  });
  if (claim.count === 0) {
    return "skipped";
  }

  try {
    if (!job.poster && !job.video) {
      throw new Error("This job's poster/video no longer exists — it may have been deleted.");
    }

    const provider = getSocialProvider(job.socialAccount);

    // Exactly one of poster/video is set per job (enforced in
    // createPublishJob's XOR validation) — build whichever buffer pair
    // PublishPostInput needs, leaving the other pair undefined.
    const imageBuffer = job.poster ? await storage.get(job.poster.asset.storageKey) : undefined;
    const videoBuffer = job.video ? await storage.get(job.video.asset.storageKey) : undefined;

    // Only Instagram needs a public URL (see instagram-provider.ts) —
    // minted right before the attempt and revoked right after, win or
    // lose, so the exposure window is as small as possible.
    const publicImageUrl =
      job.socialAccount.platform === "INSTAGRAM" && job.poster
        ? await createPublicAssetLink(job.poster.asset.id)
        : undefined;

    try {
      const result = await provider.publishPost({
        imageBuffer,
        imageMimeType: job.poster?.asset.mimeType,
        videoBuffer,
        videoMimeType: job.video?.asset.mimeType,
        caption: job.caption,
        publicImageUrl,
      });

      await db.publishJob.update({
        where: { id: job.id },
        data: {
          status: "PUBLISHED",
          externalPostId: result.externalPostId,
          externalPostUrl: result.externalPostUrl,
          errorMessage: null,
        },
      });

      // Part 2.1's real positive signal — a confirmed publish, not a
      // download/preview. Not every poster/video belongs to a Campaign
      // (standalone Studio generations don't), so topic is honestly
      // null for those rather than guessed.
      await recordSignal({
        companyId: job.companyId,
        sourceType: "PUBLISH",
        strength: SIGNAL_STRENGTH.PUBLISH,
        topic: job.poster?.campaignItem?.campaign.campaignType ?? job.video?.campaignItem?.campaign.campaignType,
        template: job.poster?.template ?? job.video?.template,
        visualStyle: job.poster?.backgroundSource,
        posterId: job.posterId,
        videoId: job.videoId,
      });
      await recomputeCreativeDnaPreferences(job.companyId);

      return "succeeded";
    } finally {
      if (publicImageUrl && job.poster) {
        await revokePublicAssetLinksForAsset(job.poster.asset.id);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    const nextRetryCount = job.retryCount + 1;
    const isPermanent = nextRetryCount >= MAX_RETRIES;
    const backoffSec = BASE_BACKOFF_SEC * 2 ** job.retryCount;

    await db.publishJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        errorMessage: message,
        retryCount: nextRetryCount,
        nextAttemptAt: isPermanent ? job.nextAttemptAt : new Date(Date.now() + backoffSec * 1000),
      },
    });
    return "failed";
  }
}

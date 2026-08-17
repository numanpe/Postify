import "server-only";

import { db } from "@/lib/db";
import { generatePosterCore } from "@/lib/poster/generate";
import { generateVideoCore } from "@/lib/video/generate";

const MAX_RETRIES = 3;
const BASE_BACKOFF_SEC = 30;
// A job stuck in GENERATING this long (e.g. the process was killed
// mid-render) is treated as abandoned and picked up again — otherwise
// a crash mid-job would leave the item stuck forever with no path back
// to PENDING/FAILED.
const STALE_GENERATING_MINUTES = 5;
// How many of the company's most-recently-uploaded assets to offer as
// B-roll for an auto-generated campaign video — matches a typical
// 5-section script without pulling in stale, unrelated old uploads.
const AUTO_SELECT_ASSET_COUNT = 6;

export interface ProcessResult {
  processedCount: number;
  succeededCount: number;
  failedCount: number;
}

// Two job types (generate this CampaignItem's poster, or its video —
// see CampaignItem.assetType), so bookkeeping still lives directly on
// the row rather than a generic queue abstraction. Poster items use the
// free brand-gradient background and SQUARE aspect ratio — a deliberate
// scope choice so a whole week of content doesn't silently rack up BYOK
// image-generation cost. Video items auto-select the company's most
// recent real media as footage (see selectAutoAssetIds below) — there's
// no UI in this unattended path for a person to pick footage, and
// video's AI-still fallback stays BYOK-only (see resolver.ts), so real
// uploaded media is the only zero-key path that works here.
//
// Processes a bounded batch per call so this is safe to run inside a
// normal request/response cycle — a server action (manual "Process
// now"), a cron-triggered route, or the fire-and-forget trigger right
// after campaign creation — rather than needing a long-running worker
// process. See src/lib/actions/campaign.ts and
// src/app/api/jobs/process-campaign-items/route.ts for the callers.
export async function processCampaignItems(batchSize = 3): Promise<ProcessResult> {
  const staleThreshold = new Date(Date.now() - STALE_GENERATING_MINUTES * 60 * 1000);

  const dueItems = await db.campaignItem.findMany({
    where: {
      nextAttemptAt: { lte: new Date() },
      OR: [
        { status: "PENDING" },
        { status: "FAILED", retryCount: { lt: MAX_RETRIES } },
        { status: "GENERATING", updatedAt: { lt: staleThreshold } },
      ],
    },
    include: { campaign: true },
    orderBy: { nextAttemptAt: "asc" },
    take: batchSize,
  });

  let succeededCount = 0;
  let failedCount = 0;

  for (const item of dueItems) {
    await db.campaignItem.update({ where: { id: item.id }, data: { status: "GENERATING" } });

    try {
      // Background jobs have no "current user" the way a request does
      // — attribute the generated asset to the company's longest-
      // standing member (typically the owner who created it).
      const membership = await db.companyMember.findFirst({
        where: { companyId: item.campaign.companyId },
        orderBy: { createdAt: "asc" },
      });
      if (!membership) {
        throw new Error("No company member found to attribute this generation to.");
      }

      if (item.assetType === "VIDEO") {
        const assetIds = await selectAutoAssetIds(item.campaign.companyId);
        const result = await generateVideoCore({
          companyId: item.campaign.companyId,
          userId: membership.userId,
          // NOT item.angle: angle is already a full sentence (the
          // Creative Director's CAMPAIGN_ARC wrapped it), and
          // generateScript's own hook/context/value/message/cta
          // templates wrap {{topic}} into ANOTHER sentence — splicing
          // one into the other produced real grammatically broken
          // narration ("We put the same care into Introducing Launch
          // our new... That we put into every harvest."), caught by
          // generating and inspecting a real video. The campaign's raw
          // objective has no such wrapping, and since only the first
          // item is ever a video (see the generateCampaignBrief doc
          // comment), there's no day-to-day topic variety to preserve
          // here the way there is for posters.
          topic: item.campaign.objective,
          aspectRatio: "SQUARE",
          useNarration: true,
          assetIds,
        });
        await db.campaignItem.update({
          where: { id: item.id },
          data: { status: "READY", videoId: result.videoId, errorMessage: null },
        });
      } else {
        const result = await generatePosterCore({
          companyId: item.campaign.companyId,
          userId: membership.userId,
          headline: item.headline ?? item.angle,
          subhead: item.subhead ?? undefined,
          cta: item.cta ?? undefined,
          aspectRatio: "SQUARE",
          // Campaign auto-generation has no per-post UI to pick a
          // template or nudge toward a photo — MINIMAL/BRAND is the
          // safest unattended default. Swapping this to reuse the
          // Poster Studio's photo-first default is a separate,
          // deliberate change, not a byproduct of this rollout.
          template: "MINIMAL",
          backgroundSource: "BRAND",
        });
        await db.campaignItem.update({
          where: { id: item.id },
          data: { status: "READY", posterId: result.posterId, errorMessage: null },
        });
      }
      succeededCount += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error.";
      const nextRetryCount = item.retryCount + 1;
      const isPermanent = nextRetryCount >= MAX_RETRIES;
      const backoffSec = BASE_BACKOFF_SEC * 2 ** item.retryCount;

      await db.campaignItem.update({
        where: { id: item.id },
        data: {
          status: "FAILED",
          errorMessage: message,
          retryCount: nextRetryCount,
          nextAttemptAt: isPermanent ? item.nextAttemptAt : new Date(Date.now() + backoffSec * 1000),
        },
      });
      failedCount += 1;
    }
  }

  return { processedCount: dueItems.length, succeededCount, failedCount };
}

// Same "real media first" principle as the Poster Studio's photo-first
// smart default (src/app/(app)/poster/page.tsx) — most-recent uploads,
// excluding brand logos and previously-generated posters/videos (never
// synthetic-on-synthetic source material). Returns [] when the company
// has no usable media; generateVideoCore then either falls back to a
// BYOK AI-still provider or throws its existing, honest "add a key or
// upload media" error — never a fake video.
async function selectAutoAssetIds(companyId: string): Promise<string[]> {
  const assets = await db.mediaAsset.findMany({
    where: {
      companyId,
      posterOutput: null,
      videoOutput: null,
      brandKitLogo: null,
      OR: [{ mimeType: { startsWith: "image/" } }, { mimeType: { startsWith: "video/" } }],
    },
    orderBy: { createdAt: "desc" },
    take: AUTO_SELECT_ASSET_COUNT,
    select: { id: true },
  });
  return assets.map((a) => a.id);
}

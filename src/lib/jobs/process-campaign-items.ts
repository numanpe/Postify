import "server-only";

import type { Campaign, CampaignItem, PosterTemplate } from "@prisma/client";

import { db } from "@/lib/db";
import { generatePosterCore } from "@/lib/poster/generate";
import { generateVideoCore } from "@/lib/video/generate";

const MAX_RETRIES = 3;
const BASE_BACKOFF_SEC = 30;
// A job stuck in GENERATING this long (e.g. the process was killed
// mid-render — see the "stuck video" investigation note below) is
// treated as abandoned and picked up again — otherwise a crash mid-job
// would leave the item stuck forever with no path back to PENDING/FAILED.
const STALE_GENERATING_MINUTES = 5;
// How many of the company's most-recently-uploaded assets to offer as
// B-roll for an auto-generated campaign video — matches a typical
// 5-section script without pulling in stale, unrelated old uploads.
const AUTO_SELECT_ASSET_COUNT = 6;
// Real, visually distinct rotation so an explicit "Regenerate" produces
// a genuinely different poster, not a pixel-identical re-render of the
// same deterministic BRAND-gradient + MINIMAL-template inputs.
const POSTER_TEMPLATE_ROTATION: PosterTemplate[] = [
  "MINIMAL",
  "BOLD_HEADLINE",
  "PROMOTIONAL_BANNER",
  "SPLIT_PRODUCT",
  "MODERN_BANNER",
  "BADGE_OFFER",
  "MINIMALIST_FRAME",
];

export interface ProcessResult {
  processedCount: number;
  succeededCount: number;
  failedCount: number;
}

type DueItem = CampaignItem & { campaign: Campaign };

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
// Real production incident (2026-08-17): a video item sat in GENERATING
// for 15+ minutes with zero progress while, in the same window, 6
// poster items in the same campaign all completed in 5-10s each across
// several separate "Process now" clicks. The pattern — poster
// completions spread across ~13 minutes with gaps, video claimed once
// and never updated again — is the signature of a request/function
// time budget that posters comfortably fit inside and a full video
// render (script + narration + ffmpeg composition) does not: whichever
// invocation claimed the video got cut off by the platform before its
// try/catch could ever run, leaving no error recorded and no path back
// except the stale-GENERATING recovery below. Fixed two ways: (1) this
// function and its callers now request the platform's maximum
// available execution time (see `maxDuration` in the route/page files
// that invoke this), and (2) at most one video is ever claimed per
// batch, so a slow video never has to compete with — or get starved
// behind — a pile of fast poster items for the same time budget.
//
// Processes a bounded batch per call so this is safe to run inside a
// normal request/response cycle — a server action (manual "Process
// now"), a cron-triggered route, or the fire-and-forget trigger right
// after campaign creation — rather than needing a long-running worker
// process. See src/lib/actions/campaign.ts and
// src/app/api/jobs/run/route.ts (?job=process-campaign-items) for the callers.
export async function processCampaignItems(batchSize = 3): Promise<ProcessResult> {
  const staleThreshold = new Date(Date.now() - STALE_GENERATING_MINUTES * 60 * 1000);
  const dueFilter = {
    nextAttemptAt: { lte: new Date() },
    OR: [
      { status: "PENDING" as const },
      { status: "FAILED" as const, retryCount: { lt: MAX_RETRIES } },
      { status: "GENERATING" as const, updatedAt: { lt: staleThreshold } },
    ],
  };

  const [posterItems, videoItems] = await Promise.all([
    db.campaignItem.findMany({
      where: { ...dueFilter, assetType: "POSTER" },
      include: { campaign: true },
      orderBy: { nextAttemptAt: "asc" },
      take: batchSize,
    }),
    db.campaignItem.findMany({
      where: { ...dueFilter, assetType: "VIDEO" },
      include: { campaign: true },
      orderBy: { nextAttemptAt: "asc" },
      take: 1,
    }),
  ]);
  const dueItems = [...posterItems, ...videoItems].sort(
    (a, b) => a.nextAttemptAt.getTime() - b.nextAttemptAt.getTime(),
  );

  let succeededCount = 0;
  let failedCount = 0;

  for (const item of dueItems) {
    const ok = await processSingleCampaignItem(item);
    if (ok) succeededCount += 1;
    else failedCount += 1;
  }

  return { processedCount: dueItems.length, succeededCount, failedCount };
}

// Extracted so a single explicit "Regenerate" click (campaign.ts) can
// await exactly one item's real generation instead of relying on the
// fire-and-forget trigger, which — like the stuck-video case above —
// isn't a delivery guarantee on serverless. Returns true/false rather
// than throwing so callers can decide what to do next without needing
// their own try/catch around DB bookkeeping that already happened.
export async function processSingleCampaignItem(item: DueItem): Promise<boolean> {
  await db.campaignItem.update({ where: { id: item.id }, data: { status: "GENERATING" } });

  try {
    // Background jobs have no "current user" the way a request does —
    // attribute the generated asset to the company's longest-standing
    // member (typically the owner who created it).
    const membership = await db.companyMember.findFirst({
      where: { companyId: item.campaign.companyId },
      orderBy: { createdAt: "asc" },
    });
    if (!membership) {
      throw new Error("No company member found to attribute this generation to.");
    }

    if (item.assetType === "VIDEO") {
      const assetIds = await selectAutoAssetIds(item.campaign.companyId, item.generationAttempt);
      const result = await generateVideoCore({
        companyId: item.campaign.companyId,
        userId: membership.userId,
        // NOT item.angle: angle is already a full sentence (the
        // Creative Director's CAMPAIGN_ARC wrapped it), and
        // generateScript's own hook/context/value/message/cta
        // templates wrap {{topic}} into ANOTHER sentence — splicing
        // one into the other produced real grammatically broken
        // narration. The campaign's raw objective has no such
        // wrapping, and since only the first item is ever a video (see
        // generateCampaignBrief's doc comment), there's no day-to-day
        // topic variety to preserve here the way there is for posters.
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
        // Rotates with generationAttempt (0 on first generation) so an
        // explicit regenerate produces a visually distinct poster, not
        // a pixel-identical copy — the BRAND gradient + identical text
        // inputs are otherwise fully deterministic. Campaign
        // auto-generation still has no per-post UI for a person to
        // pick a template.
        template: POSTER_TEMPLATE_ROTATION[item.generationAttempt % POSTER_TEMPLATE_ROTATION.length],
        backgroundSource: "BRAND",
      });
      await db.campaignItem.update({
        where: { id: item.id },
        data: { status: "READY", posterId: result.posterId, errorMessage: null },
      });
    }
    return true;
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
    return false;
  }
}

// Same "real media first" principle as the Poster Studio's photo-first
// smart default (src/app/(app)/poster/page.tsx) — most-recent uploads,
// excluding brand logos and previously-generated posters/videos (never
// synthetic-on-synthetic source material). Returns [] when the company
// has no usable media; generateVideoCore then either falls back to a
// BYOK AI-still provider or throws its existing, honest "add a key or
// upload media" error — never a fake video, never a hang (that error is
// thrown well before any ffmpeg work starts, and is caught by
// processSingleCampaignItem's try/catch like any other failure).
//
// attempt rotates the starting offset into the company's recent-media
// list so an explicit regenerate uses a genuinely different clip
// selection, not the identical footage in the identical order.
export async function selectAutoAssetIds(companyId: string, attempt: number): Promise<string[]> {
  const pool = await db.mediaAsset.findMany({
    where: {
      companyId,
      posterOutput: null,
      videoOutput: null,
      brandKitLogo: null,
      OR: [{ mimeType: { startsWith: "image/" } }, { mimeType: { startsWith: "video/" } }],
    },
    orderBy: { createdAt: "desc" },
    take: AUTO_SELECT_ASSET_COUNT * 2,
    select: { id: true },
  });
  if (pool.length === 0) return [];
  const offset = attempt % pool.length;
  const rotated = [...pool.slice(offset), ...pool.slice(0, offset)];
  return rotated.slice(0, AUTO_SELECT_ASSET_COUNT).map((a) => a.id);
}

import "server-only";

import { db } from "@/lib/db";
import { generatePosterCore, PosterGenerationError } from "@/lib/poster/generate";

const MAX_RETRIES = 3;
const BASE_BACKOFF_SEC = 30;
// A job stuck in GENERATING this long (e.g. the process was killed
// mid-render) is treated as abandoned and picked up again — otherwise
// a crash mid-job would leave the item stuck forever with no path back
// to PENDING/FAILED.
const STALE_GENERATING_MINUTES = 5;

export interface ProcessResult {
  processedCount: number;
  succeededCount: number;
  failedCount: number;
}

// One job type (generate this CampaignItem's poster), so bookkeeping
// lives directly on the row rather than a generic queue abstraction.
// Campaign items always use the free brand-gradient background and
// SQUARE aspect ratio — a deliberate scope choice so a whole week of
// content doesn't silently rack up BYOK image-generation cost, and so
// this phase proves the job/retry/calendar machinery rather than
// re-testing background-source variety Phase 3 already covers.
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
        throw new PosterGenerationError("No company member found to attribute this generation to.");
      }

      const result = await generatePosterCore({
        companyId: item.campaign.companyId,
        userId: membership.userId,
        headline: item.angle,
        aspectRatio: "SQUARE",
        backgroundSource: "BRAND",
      });

      await db.campaignItem.update({
        where: { id: item.id },
        data: { status: "READY", posterId: result.posterId, errorMessage: null },
      });
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

import "server-only";

import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { createPublicAssetLink, revokePublicAssetLinksForAsset } from "@/lib/public-asset-links";
import { getSocialProvider } from "@/lib/providers/social/resolver";

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
    include: { socialAccount: true, poster: { include: { asset: true } } },
    orderBy: { nextAttemptAt: "asc" },
    take: batchSize,
  });

  let succeededCount = 0;
  let failedCount = 0;

  for (const job of dueJobs) {
    await db.publishJob.update({ where: { id: job.id }, data: { status: "PUBLISHING" } });

    try {
      if (!job.poster) {
        throw new Error("This job's poster no longer exists — it may have been deleted.");
      }

      const provider = getSocialProvider(job.socialAccount);
      const imageBuffer = await storage.get(job.poster.asset.storageKey);

      // Only Instagram needs a public URL (see instagram-provider.ts) —
      // minted right before the attempt and revoked right after, win or
      // lose, so the exposure window is as small as possible.
      const publicImageUrl =
        job.socialAccount.platform === "INSTAGRAM"
          ? await createPublicAssetLink(job.poster.asset.id)
          : undefined;

      try {
        const result = await provider.publishPost({
          imageBuffer,
          imageMimeType: job.poster.asset.mimeType,
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
        succeededCount += 1;
      } finally {
        if (publicImageUrl) {
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
      failedCount += 1;
    }
  }

  return { processedCount: dueJobs.length, succeededCount, failedCount };
}

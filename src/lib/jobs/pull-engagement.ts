import "server-only";

import { db } from "@/lib/db";
import { getSocialProvider } from "@/lib/providers/social/resolver";
import { updateCreativeDnaLearning } from "@/lib/creative-dna/learning";
import { computePeakPublishHour } from "@/lib/scheduling/smart-scheduler";

export interface PullEngagementResult {
  pulledCount: number;
  skippedCount: number;
}

// CLAUDE.md Phase 7's real engagement pull — daily cron
// (flag-stale-media's sibling route). Only the Direct Meta API path is
// covered: the four BYOK aggregator providers (Zernio/Postproxy/Buffer/
// Upload-Post) would each need their own analytics-endpoint
// verification with the same rigor as their publish endpoints (see the
// Provider Reality Check work in src/lib/providers/aggregator/) before
// this app calls them — not done yet, so their published posts aren't
// measured here. This is a real, disclosed scope limit, not a silent gap.
export async function pullEngagementData(): Promise<PullEngagementResult> {
  const jobs = await db.publishJob.findMany({
    where: { status: "PUBLISHED", externalPostId: { not: null } },
    include: { socialAccount: true, poster: { include: { campaignItem: true } } },
  });

  let pulledCount = 0;
  let skippedCount = 0;

  for (const job of jobs) {
    // Same explicit-vs-implicit exclusion as learning.ts — a post whose
    // CampaignItem was deleted or regenerated away isn't real evidence
    // about content this app should suggest again.
    if (!job.poster?.campaignItem || !job.externalPostId) {
      skippedCount += 1;
      continue;
    }

    try {
      const provider = getSocialProvider(job.socialAccount);
      const engagement = await provider.getEngagement(job.externalPostId);
      await db.engagementSnapshot.create({
        data: {
          companyId: job.companyId,
          publishJobId: job.id,
          likes: engagement.likes,
          comments: engagement.comments,
          shares: engagement.shares,
          reach: engagement.reach,
        },
      });
      pulledCount += 1;
    } catch {
      // A real per-post failure (token expired, post deleted upstream,
      // rate limit) never blocks the rest of the batch — same pattern as
      // process-publish-jobs.ts's per-job try/catch.
      skippedCount += 1;
    }
  }

  const companyIds = [...new Set(jobs.map((job) => job.companyId))];
  for (const companyId of companyIds) {
    await updateCreativeDnaLearning(companyId);
    await computePeakPublishHour(companyId);
  }

  return { pulledCount, skippedCount };
}

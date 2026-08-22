import "server-only";

import { db } from "@/lib/db";
import { getSocialProvider } from "@/lib/providers/social/resolver";
import { updateCreativeDnaLearning, computeCompanyAverageEngagement } from "@/lib/creative-dna/learning";
import { computePeakPublishHour } from "@/lib/scheduling/smart-scheduler";
import { recordSignal, engagementSignalStrength } from "@/lib/creative-dna/signals";
import { recomputeCreativeDnaPreferences } from "@/lib/creative-dna/aggregate";

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
    include: { socialAccount: true, poster: { include: { campaignItem: { include: { campaign: true } } } } },
  });

  let pulledCount = 0;
  let skippedCount = 0;
  // Collected during the pull loop below so the ENGAGEMENT signal pass
  // (after per-company averages are known) doesn't need a second query
  // — only jobs actually measured in THIS run get a signal, never a
  // re-recorded one for a post whose engagement was already pulled on
  // a prior day (that would make the sample-count/decay math treat one
  // real post as N pieces of evidence).
  const freshlyMeasured: { job: (typeof jobs)[number]; totalInteractions: number }[] = [];

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
      freshlyMeasured.push({ job, totalInteractions: engagement.likes + engagement.comments + engagement.shares });
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

    // Part 2.3/4.4's real, specific signal — computed against the same
    // company-average baseline updateCreativeDnaLearning just used,
    // fetched fresh so it reflects the snapshots created above. Scaled
    // via engagementSignalStrength (signals.ts) so real above/below-
    // average performance can meaningfully outweigh (soften or
    // reinforce) the flat +0.7 PUBLISH signal already recorded for the
    // same content when aggregate.ts sums them.
    const companyAverage = await computeCompanyAverageEngagement(companyId);
    if (companyAverage === null || companyAverage === 0) continue;

    const companyJobs = freshlyMeasured.filter(({ job }) => job.companyId === companyId);
    for (const { job, totalInteractions } of companyJobs) {
      const relativeScore = totalInteractions / companyAverage;
      await recordSignal({
        companyId,
        sourceType: "ENGAGEMENT",
        strength: engagementSignalStrength(relativeScore),
        topic: job.poster?.campaignItem?.campaign.campaignType,
        template: job.poster?.template,
        visualStyle: job.poster?.backgroundSource,
        posterId: job.posterId,
        metadata: { relativeScore: Number(relativeScore.toFixed(2)), totalInteractions },
      });
    }
    if (companyJobs.length > 0) await recomputeCreativeDnaPreferences(companyId);
  }

  return { pulledCount, skippedCount };
}

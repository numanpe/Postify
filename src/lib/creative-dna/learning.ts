import "server-only";
import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { MIN_SAMPLE_SIZE, confidenceTierFor } from "@/lib/creative-dna/signals";
import type { TopicScore, CreativeDnaConfidenceScores } from "@/lib/creative-dna/types";

export type { TopicScore, PeakPublishHour, CreativeDnaConfidenceScores } from "@/lib/creative-dna/types";

// Recomputes confidence-scored topic performance for one company from
// real engagement snapshots — never called with synthetic data. Topics
// are Campaign.campaignType (the AI Creative Director's own real
// category, e.g. "Educational", "Product Launch" — see Campaign's doc
// comment in schema.prisma), not a new taxonomy invented for this.
//
// Explicit-vs-implicit safety (CLAUDE.md): raw engagement is an implicit
// signal by nature, so this never lets it override a real explicit one —
// concretely, a post whose CampaignItem was later deleted or
// regenerated away is excluded entirely (see the poster?.campaignItem
// check below), so a highly-viewed post the owner didn't want isn't
// treated as a success signal just because an audience saw it.
export async function updateCreativeDnaLearning(companyId: string): Promise<void> {
  const jobs = await db.publishJob.findMany({
    where: { companyId, status: "PUBLISHED" },
    include: {
      poster: { include: { campaignItem: { include: { campaign: true } } } },
      engagementSnapshots: { orderBy: { fetchedAt: "desc" }, take: 1 },
    },
  });

  const byTopic = new Map<string, number[]>();
  for (const job of jobs) {
    const campaignItem = job.poster?.campaignItem;
    const snapshot = job.engagementSnapshots[0];
    if (!campaignItem || !snapshot) continue; // no longer live, or never measured

    const topic = campaignItem.campaign.campaignType;
    const totalInteractions = snapshot.likes + snapshot.comments + snapshot.shares;
    const list = byTopic.get(topic) ?? [];
    list.push(totalInteractions);
    byTopic.set(topic, list);
  }

  const allValues = [...byTopic.values()].flat();
  // Nothing measured yet — leave any existing confidenceScores alone
  // rather than overwrite real prior learning with an empty result.
  if (allValues.length === 0) return;

  const overallAverage = averageOf(allValues);

  const topics: Record<string, TopicScore> = {};
  for (const [topic, values] of byTopic) {
    if (values.length < MIN_SAMPLE_SIZE) continue;
    const topicAverage = values.reduce((a, b) => a + b, 0) / values.length;
    topics[topic] = {
      relativeScore: overallAverage > 0 ? Number((topicAverage / overallAverage).toFixed(2)) : 1,
      sampleSize: values.length,
      confidenceTier: confidenceTierFor(values.length),
      updatedAt: new Date().toISOString(),
    };
  }

  // confidenceScores is one JSON column shared with smart-scheduler.ts's
  // peakPublishHours key — read-merge-write, not a blind overwrite, or
  // whichever of the two writers runs second would silently erase the
  // other's real learned data on every cron pass.
  const existing = await db.creativeDna.findUnique({ where: { companyId }, select: { confidenceScores: true } });
  const existingScores = (existing?.confidenceScores ?? {}) as Partial<CreativeDnaConfidenceScores>;
  const scores: CreativeDnaConfidenceScores = { ...existingScores, topics };
  // Prisma's Json input type needs a plain indexable object — the named
  // interface is for callers reading this back (creative-dna-insights.tsx),
  // not for what Prisma accepts on write.
  const scoresJson = scores as unknown as Prisma.InputJsonValue;
  await db.creativeDna.upsert({
    where: { companyId },
    create: { companyId, confidenceScores: scoresJson },
    update: { confidenceScores: scoresJson },
  });
}

function averageOf(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

// Same "measured, still-live posts only" definition of a company's
// average engagement that updateCreativeDnaLearning uses internally —
// exported so pull-engagement.ts's per-post ENGAGEMENT signal (Part
// 2.3/4.4) compares against the exact same baseline this file's own
// topic scores use, not a second, subtly different average.
export async function computeCompanyAverageEngagement(companyId: string): Promise<number | null> {
  const jobs = await db.publishJob.findMany({
    where: { companyId, status: "PUBLISHED" },
    include: {
      poster: { include: { campaignItem: true } },
      engagementSnapshots: { orderBy: { fetchedAt: "desc" }, take: 1 },
    },
  });

  const values = jobs
    .filter((job) => job.poster?.campaignItem && job.engagementSnapshots[0])
    .map((job) => {
      const snapshot = job.engagementSnapshots[0];
      return snapshot.likes + snapshot.comments + snapshot.shares;
    });

  return values.length > 0 ? averageOf(values) : null;
}

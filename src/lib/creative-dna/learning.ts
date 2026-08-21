import "server-only";
import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";

// CLAUDE.md's Creative DNA rule: preferences must not shift on
// single-post overfitting. A topic needs at least this many measured,
// still-live posts before its score is surfaced at all — below this,
// the topic is simply omitted (not shown as "learned", not shown as
// zero), which is the honest state.
const MIN_SAMPLE_SIZE = 5;
const MEDIUM_SAMPLE_SIZE = 10;
const HIGH_SAMPLE_SIZE = 20;

export interface TopicScore {
  relativeScore: number; // 2.8 means "2.8x the company's own average engagement"
  sampleSize: number;
  confidenceTier: "low" | "medium" | "high";
  updatedAt: string;
}

// peakPublishHours is written by smart-scheduler.ts (src/lib/scheduling/),
// not this file — declared here anyway since both share the one
// confidenceScores JSON column and need to agree on its shape.
export interface PeakPublishHour {
  hourGst: number; // 0-23, Gulf Standard Time (UTC+4)
  sampleSize: number;
  confidenceTier: "low" | "medium" | "high";
  updatedAt: string;
}

export interface CreativeDnaConfidenceScores {
  topics: Record<string, TopicScore>;
  peakPublishHours?: PeakPublishHour;
}

function confidenceTierFor(sampleSize: number): "low" | "medium" | "high" {
  if (sampleSize >= HIGH_SAMPLE_SIZE) return "high";
  if (sampleSize >= MEDIUM_SAMPLE_SIZE) return "medium";
  return "low";
}

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

  const overallAverage = allValues.reduce((a, b) => a + b, 0) / allValues.length;

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

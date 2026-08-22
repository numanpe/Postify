import "server-only";
import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { decayedWeight, confidenceTierFor, MIN_SAMPLE_SIZE } from "@/lib/creative-dna/signals";
import type { CreativeDnaConfidenceScores, PreferenceScore, CreativeDnaPreferences } from "@/lib/creative-dna/types";

export type { PreferenceScore, CreativeDnaPreferences } from "@/lib/creative-dna/types";

type Dimension = "topic" | "template" | "tone" | "visualStyle";
const DIMENSIONS: { key: Dimension; out: keyof CreativeDnaPreferences }[] = [
  { key: "topic", out: "topics" },
  { key: "template", out: "templates" },
  { key: "tone", out: "tones" },
  { key: "visualStyle", out: "visualStyles" },
];

function aggregateDimension(
  signals: { value: string; strength: number; createdAt: Date }[],
  now: Date,
): Record<string, PreferenceScore> {
  const byValue = new Map<string, { weight: number; count: number }>();
  for (const signal of signals) {
    const entry = byValue.get(signal.value) ?? { weight: 0, count: 0 };
    entry.weight += decayedWeight(signal.strength, signal.createdAt, now);
    entry.count += 1;
    byValue.set(signal.value, entry);
  }

  const result: Record<string, PreferenceScore> = {};
  for (const [value, { weight, count }] of byValue) {
    // Same statistical-caution bar as learning.ts's engagement scoring
    // — a value with fewer than MIN_SAMPLE_SIZE contributing events is
    // omitted entirely (not shown as "learned", not shown as zero) per
    // CLAUDE.md's no-single-post-overfitting rule. One deleted poster
    // about a topic must not, by itself, do anything measurable.
    if (count < MIN_SAMPLE_SIZE) continue;
    result[value] = {
      score: Number(weight.toFixed(3)),
      sampleSize: count,
      confidenceTier: confidenceTierFor(count),
      updatedAt: now.toISOString(),
    };
  }
  return result;
}

// Recomputes confidenceScores.preferences (the delete/publish/edit/
// regenerate/engagement signal system) from the real CreativeSignal
// log for one company. Deliberately separate from
// confidenceScores.topics (learning.ts's real-engagement-performance
// numbers, computed independently) — these are complementary, not
// competing, sources of evidence: "does this company tend to keep and
// publish this topic" vs. "does this topic actually perform well" are
// different real questions with different answers, shown side-by-side
// in the review UI rather than force-merged into one opaque score.
//
// Locked topics (CreativeDna.lockedTopics) are carried forward
// unchanged from whatever was already stored — new signals against a
// locked topic are still recorded in the CreativeSignal log (the raw
// event history stays real and complete), they just stop moving that
// topic's displayed/consumed score once locked.
export async function recomputeCreativeDnaPreferences(companyId: string): Promise<void> {
  const [signals, creativeDna] = await Promise.all([
    db.creativeSignal.findMany({
      where: { companyId },
      select: { sourceType: true, strength: true, topic: true, template: true, tone: true, visualStyle: true, createdAt: true },
    }),
    db.creativeDna.findUnique({ where: { companyId }, select: { confidenceScores: true, lockedTopics: true } }),
  ]);

  if (signals.length === 0) return; // nothing to compute yet — leave any existing state alone

  const now = new Date();
  const existingScores = (creativeDna?.confidenceScores ?? {}) as Partial<CreativeDnaConfidenceScores>;
  const existingPreferences = (existingScores as { preferences?: CreativeDnaPreferences }).preferences;
  const lockedTopics = new Set(creativeDna?.lockedTopics ?? []);

  const preferences: CreativeDnaPreferences = { topics: {}, templates: {}, tones: {}, visualStyles: {} };

  for (const { key, out } of DIMENSIONS) {
    const forDimension = signals
      .filter((s): s is typeof s & Record<Dimension, string> => Boolean(s[key]))
      .map((s) => ({ value: s[key] as string, strength: s.strength, createdAt: s.createdAt }));
    preferences[out] = aggregateDimension(forDimension, now);
  }

  // Locked topics win over the fresh computation above, using whatever
  // was already stored — a lock freezes the score, it doesn't freeze
  // the underlying evidence collection.
  if (existingPreferences?.topics) {
    for (const topic of lockedTopics) {
      if (existingPreferences.topics[topic]) {
        preferences.topics[topic] = existingPreferences.topics[topic];
      } else {
        delete preferences.topics[topic];
      }
    }
  }

  // Same read-merge-write discipline as learning.ts/smart-scheduler.ts
  // — confidenceScores is one JSON column with three independent
  // writers now (topics/peakPublishHours/preferences), so a blind
  // overwrite here would erase whichever of the other two ran most
  // recently.
  const merged = { ...existingScores, preferences };
  const mergedJson = merged as unknown as Prisma.InputJsonValue;
  await db.creativeDna.upsert({
    where: { companyId },
    create: { companyId, confidenceScores: mergedJson },
    update: { confidenceScores: mergedJson },
  });
}

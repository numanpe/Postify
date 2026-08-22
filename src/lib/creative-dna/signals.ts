import "server-only";
import { createHash } from "node:crypto";

import { db } from "@/lib/db";
import type { SignalSource, Prisma } from "@prisma/client";

// The one coherent signal-strength hierarchy for everyday-usage
// learning (Part 2 of the delete/publish-as-signals spec explicitly
// requires reusing a single existing scale rather than inventing a new
// one per feature — an audit found no general-purpose scale existed
// beforehand, only learning.ts's single-purpose engagement/average
// ratio, so this is that scale, defined once, imported everywhere a
// signal gets recorded).
//
// Ordering, from the spec's own reasoning:
//   DELETE is explicit and deliberate -> strong negative.
//   REGEN_REJECTED is soft -> the user may have simply preferred the
//     other option, not rejected this one outright.
//   REGEN_CHOSEN mirrors REGEN_REJECTED in magnitude, opposite sign.
//   EDIT is a real, deliberate action but informs a narrower thing
//     (tone/voice), not "reject this topic" -> modest.
//   PUBLISH is explicit and confirmed (per the existing confirmation-
//     based publish tracking, not a download/preview) -> stronger than
//     the soft signals, still weaker than real audience evidence.
//   ENGAGEMENT is the most concrete, most specific evidence available
//     (real audience response, not just intent) -> scaled by how far
//     above/below the company's own average it lands, can outweigh a
//     PUBLISH signal for the same content when aggregated (Part 4.4's
//     "later, more concrete evidence should be able to soften or
//     override the earlier assumption").
//   LIKE/DISLIKE are not produced anywhere yet (no such UI exists —
//     confirmed by a full audit before this file was written) but are
//     reserved as the strongest explicit signals for whenever a rating
//     control is built, so it plugs into this same system instead of a
//     second one.
export const SIGNAL_STRENGTH: Record<SignalSource, number> = {
  DELETE: -1.0,
  REGEN_REJECTED: -0.3,
  REGEN_CHOSEN: 0.3,
  EDIT: -0.25,
  PUBLISH: 0.7,
  ENGAGEMENT: 0, // computed per-call from real relativeScore, see engagementSignalStrength()
  DISLIKE: -1.2,
  LIKE: 1.2,
};

const ENGAGEMENT_SCALE = 1.5;
const ENGAGEMENT_CLAMP = 2.0;

// relativeScore of 1 = exactly the company's own average (neutral); >1
// = above average (positive); <1 = below average (negative). Centered
// on 0 and scaled so a real standout post (e.g. 2x average) can
// meaningfully outweigh a single PUBLISH signal's flat +0.7 — concrete
// evidence should dominate mere intent, per Part 4.4.
export function engagementSignalStrength(relativeScore: number): number {
  const raw = (relativeScore - 1) * ENGAGEMENT_SCALE;
  return Math.max(-ENGAGEMENT_CLAMP, Math.min(ENGAGEMENT_CLAMP, raw));
}

// Recency decay — half-life, not a hard cutoff, so a signal never
// vanishes outright but genuinely matters less as it ages (Part 4.3).
// 120 days (~4 months) is long enough that a business's real, sustained
// style still dominates, short enough that a clear recent shift in
// behavior visibly outweighs a stale pattern within one aggregation
// window — tunable in one place if that balance turns out wrong.
const SIGNAL_HALF_LIFE_DAYS = 120;

export function decayedWeight(strength: number, createdAt: Date, now: Date = new Date()): number {
  const ageDays = Math.max(0, (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
  return strength * Math.pow(0.5, ageDays / SIGNAL_HALF_LIFE_DAYS);
}

// Same statistical-caution bar as learning.ts's engagement scoring
// (CLAUDE.md: no single-post overfitting) — exported from here so
// every signal consumer (aggregate.ts, learning.ts) shares the exact
// same thresholds instead of each defining its own.
export const MIN_SAMPLE_SIZE = 5;
export const MEDIUM_SAMPLE_SIZE = 10;
export const HIGH_SAMPLE_SIZE = 20;

export function confidenceTierFor(sampleSize: number): "low" | "medium" | "high" {
  if (sampleSize >= HIGH_SAMPLE_SIZE) return "high";
  if (sampleSize >= MEDIUM_SAMPLE_SIZE) return "medium";
  return "low";
}

// Normalizes generated text (whitespace/case-insensitive) before
// hashing — a caption regenerated with only incidental whitespace
// differences should still count as "the same output" for the
// never-repeat-a-deleted-output rule; a genuinely different sentence
// should not.
export function fingerprintContent(text: string): string {
  const normalized = text.trim().toLowerCase().replace(/\s+/g, " ");
  return createHash("sha256").update(normalized).digest("hex");
}

export interface RecordSignalInput {
  companyId: string;
  sourceType: SignalSource;
  strength: number;
  topic?: string | null;
  template?: string | null;
  tone?: string | null;
  visualStyle?: string | null;
  posterId?: string | null;
  videoId?: string | null;
  campaignItemId?: string | null;
  contentFingerprint?: string | null;
  metadata?: Record<string, unknown>;
}

// The one write path for every signal type — every hook (delete,
// publish, edit, regenerate, engagement) calls this rather than
// touching db.creativeSignal directly, so the shape stays consistent
// and any future cross-cutting change (e.g. a batch/queue) has one
// place to land.
export async function recordSignal(input: RecordSignalInput): Promise<void> {
  await db.creativeSignal.create({
    data: {
      companyId: input.companyId,
      sourceType: input.sourceType,
      strength: input.strength,
      topic: input.topic ?? undefined,
      template: input.template ?? undefined,
      tone: input.tone ?? undefined,
      visualStyle: input.visualStyle ?? undefined,
      posterId: input.posterId ?? undefined,
      videoId: input.videoId ?? undefined,
      campaignItemId: input.campaignItemId ?? undefined,
      contentFingerprint: input.contentFingerprint ?? undefined,
      metadata: input.metadata ? (input.metadata as unknown as Prisma.InputJsonValue) : undefined,
    },
  });
}

// Part 1.1's real, immediate rule: never regenerate the exact same
// deleted output again. Exact-content match (not input-match) — only
// the literal text a company explicitly deleted is blocked, so a
// future generation on a similar topic isn't needlessly constrained.
export async function wasContentDeleted(companyId: string, text: string): Promise<boolean> {
  const fingerprint = fingerprintContent(text);
  const match = await db.creativeSignal.findFirst({
    where: { companyId, sourceType: "DELETE", contentFingerprint: fingerprint },
    select: { id: true },
  });
  return match !== null;
}

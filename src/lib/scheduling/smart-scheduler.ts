import "server-only";
import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import type { CreativeDnaConfidenceScores, PeakPublishHour } from "@/lib/creative-dna/learning";

// UAE/GCC audience default — no DST in the Gulf, so a fixed +4 offset
// is safe year-round (unlike e.g. US/EU timezones). 13:00 GST sits in
// the middle of the 12-2pm midday window; 20:00 GST sits in the middle
// of the 7-9pm evening window. Only the midday one is auto-suggested
// today — surfacing both as alternate options is a reasonable future
// iteration, not needed for a single "auto-schedule" button.
export const GST_OFFSET_HOURS = 4;
export const DEFAULT_PEAK_HOUR_GST = 13;
export const ALTERNATE_PEAK_HOUR_GST = 20;

// Same threshold and "no single-post overfitting" philosophy as
// creative-dna/learning.ts's MIN_SAMPLE_SIZE — a hint from 1-2 lucky
// posts isn't real evidence. Below this, the static GCC default is
// used and no "learned" claim is made.
const MIN_SAMPLE_SIZE = 5;

function gstHourOf(date: Date): number {
  return (date.getUTCHours() + GST_OFFSET_HOURS) % 24;
}

// Real engagement -> a real learned peak hour, cached onto CreativeDna
// (same table/column learning.ts's topic scores live in) so the UI
// action below is a fast read, not a live scan on every button click.
// Called from pull-engagement.ts's daily cron, right alongside
// updateCreativeDnaLearning — same real data, no separate fetch.
//
// publishJob.updatedAt is used as "when this actually went live" —
// there's no dedicated publishedAt column; for a row whose status is
// PUBLISHED, the last mutation is the publish confirmation itself
// (externalPostId/status getting set), which is the closest real
// signal available without a schema change just for this.
export async function computePeakPublishHour(companyId: string): Promise<void> {
  const jobs = await db.publishJob.findMany({
    where: { companyId, status: "PUBLISHED" },
    include: { engagementSnapshots: { orderBy: { fetchedAt: "desc" }, take: 1 } },
  });

  const byHour = new Map<number, number[]>();
  for (const job of jobs) {
    const snapshot = job.engagementSnapshots[0];
    if (!snapshot) continue; // never measured
    const hour = gstHourOf(job.updatedAt);
    const total = snapshot.likes + snapshot.comments + snapshot.shares;
    byHour.set(hour, [...(byHour.get(hour) ?? []), total]);
  }

  let best: { hour: number; avg: number; sampleSize: number } | null = null;
  for (const [hour, values] of byHour) {
    if (values.length < MIN_SAMPLE_SIZE) continue; // not enough evidence for this hour specifically
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    if (!best || avg > best.avg) best = { hour, avg, sampleSize: values.length };
  }

  // Nothing crossed the evidence bar yet — leave any existing learned
  // value alone rather than overwrite real prior learning with nothing,
  // same honesty rule learning.ts already follows for topic scores.
  if (!best) return;

  const confidenceTier: PeakPublishHour["confidenceTier"] =
    best.sampleSize >= 20 ? "high" : best.sampleSize >= 10 ? "medium" : "low";
  const peakPublishHours: PeakPublishHour = {
    hourGst: best.hour,
    sampleSize: best.sampleSize,
    confidenceTier,
    updatedAt: new Date().toISOString(),
  };

  const existing = await db.creativeDna.findUnique({ where: { companyId }, select: { confidenceScores: true } });
  const existingScores = (existing?.confidenceScores ?? {}) as Partial<CreativeDnaConfidenceScores>;
  const scores: CreativeDnaConfidenceScores = {
    topics: existingScores.topics ?? {},
    peakPublishHours,
  };
  const scoresJson = scores as unknown as Prisma.InputJsonValue;
  await db.creativeDna.upsert({
    where: { companyId },
    create: { companyId, confidenceScores: scoresJson },
    update: { confidenceScores: scoresJson },
  });
}

export interface SuggestedPublishTime {
  scheduledFor: Date;
  hourGst: number;
  source: "learned" | "default";
  sampleSize?: number;
  confidenceTier?: PeakPublishHour["confidenceTier"];
}

// The one real "smart" decision this makes: use the company's own
// measured peak hour once there's enough real evidence for it (see
// computePeakPublishHour), otherwise fall back to the static GCC
// default — never a fabricated "we analyzed your audience" claim
// dressed up as a real number when it's actually just the default.
export async function suggestPeakPublishTime(
  companyId: string,
  referenceNow: Date = new Date(),
): Promise<SuggestedPublishTime> {
  const creativeDna = await db.creativeDna.findUnique({ where: { companyId }, select: { confidenceScores: true } });
  const scores = creativeDna?.confidenceScores as CreativeDnaConfidenceScores | undefined;
  const learned = scores?.peakPublishHours;

  const hourGst = learned?.hourGst ?? DEFAULT_PEAK_HOUR_GST;
  const scheduledFor = nextOccurrenceOfGstHour(hourGst, referenceNow);

  return {
    scheduledFor,
    hourGst,
    source: learned ? "learned" : "default",
    sampleSize: learned?.sampleSize,
    confidenceTier: learned?.confidenceTier,
  };
}

// Today at hourGst if that's still in the future relative to
// referenceNow, otherwise tomorrow — a suggestion is only useful if
// it's actually schedulable.
function nextOccurrenceOfGstHour(hourGst: number, referenceNow: Date): Date {
  const utcHour = (hourGst - GST_OFFSET_HOURS + 24) % 24;
  const candidate = new Date(
    Date.UTC(referenceNow.getUTCFullYear(), referenceNow.getUTCMonth(), referenceNow.getUTCDate(), utcHour, 0, 0),
  );
  if (candidate <= referenceNow) {
    candidate.setUTCDate(candidate.getUTCDate() + 1);
  }
  return candidate;
}

// createPublishJob (src/lib/actions/publish.ts) parses its
// scheduledFor field with `new Date(scheduledFor)` on a plain
// "YYYY-MM-DDTHH:mm" string, which JS interprets as the SERVER
// process's own local time zone (a deliberate existing choice — see
// that file's own comment). Formatting the suggested UTC instant back
// out using the same process's local Date getters (not UTC getters)
// keeps the round trip self-consistent regardless of what timezone the
// server actually runs in, dev machine or Vercel.
export function formatForDatetimeLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

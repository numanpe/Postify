import "server-only";

import { db } from "@/lib/db";
import { sendEmail, EmailNotConfiguredError } from "@/lib/email";
import { signUnsubscribeToken } from "@/lib/unsubscribe-token";
import { GST_OFFSET_HOURS } from "@/lib/scheduling/smart-scheduler";
import { buildWeeklyDigestHtml, buildWeeklyDigestSubject, type WeeklyDigestInsight, type WeeklyDigestData } from "@/lib/jobs/weekly-digest-email";

// Same "no single-post overfitting" bar every other Creative DNA
// insight in this app already uses (aggregate.ts, learning.ts,
// smart-scheduler.ts) — an insight computed from fewer real measured
// posts than this is never shown, per CLAUDE.md's explicit statistical-
// caution requirement.
const MIN_SAMPLE_SIZE = 5;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function average(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function getAppUrl(): string {
  const url = process.env.APP_URL;
  if (!url) {
    throw new Error("APP_URL is not set — required to build weekly-digest links.");
  }
  return url.replace(/\/$/, "");
}

// GST-shifted day-of-week (0=Sunday..6=Saturday) — same offset
// smart-scheduler.ts's peak-hour learning already uses, so "your
// Tuesday posts perform best" means Tuesday in the same real timezone
// the rest of this app's scheduling intelligence is anchored to, not a
// second, inconsistent notion of "day" measured in server UTC.
function gstDayOfWeek(date: Date): number {
  const shifted = new Date(date.getTime() + GST_OFFSET_HOURS * 60 * 60 * 1000);
  return shifted.getUTCDay();
}

// Two independent real comparisons attempted, in priority order — the
// first one with enough real evidence wins. Both are computed fresh per
// send, not cached, since "enough evidence" changes week to week.
async function computeInsight(companyId: string, windowStart: Date, now: Date): Promise<WeeklyDigestInsight | null> {
  // 1) Photo vs. video engagement, scoped to THIS week's real published +
  // measured posts — matches the user's own example ("this week").
  const weekJobs = await db.publishJob.findMany({
    where: { companyId, status: "PUBLISHED", updatedAt: { gte: windowStart, lt: now } },
    select: { posterId: true, videoId: true, engagementSnapshots: { orderBy: { fetchedAt: "desc" }, take: 1 } },
  });

  const photoValues: number[] = [];
  const videoValues: number[] = [];
  for (const job of weekJobs) {
    const snapshot = job.engagementSnapshots[0];
    if (!snapshot) continue;
    const total = snapshot.likes + snapshot.comments + snapshot.shares;
    if (job.posterId) photoValues.push(total);
    else if (job.videoId) videoValues.push(total);
  }

  if (photoValues.length >= MIN_SAMPLE_SIZE && videoValues.length >= MIN_SAMPLE_SIZE) {
    const photoAvg = average(photoValues);
    const videoAvg = average(videoValues);
    if (photoAvg > 0 && videoAvg > 0) {
      if (videoAvg / photoAvg >= 1.15) {
        return { kind: "format", winner: "video", ratio: videoAvg / photoAvg, sampleSize: photoValues.length + videoValues.length };
      }
      if (photoAvg / videoAvg >= 1.15) {
        return { kind: "format", winner: "photo", ratio: photoAvg / videoAvg, sampleSize: photoValues.length + videoValues.length };
      }
    }
  }

  // 2) Best day-of-week, drawn from the company's real full publish
  // history (not just this week — a weekly cadence pattern needs more
  // than 7 days of evidence to be real, same reasoning
  // computePeakPublishHour already applies to hour-of-day). Presented
  // honestly as an ongoing pattern, not scoped to "this week" in the copy.
  const allJobs = await db.publishJob.findMany({
    where: { companyId, status: "PUBLISHED" },
    select: { updatedAt: true, engagementSnapshots: { orderBy: { fetchedAt: "desc" }, take: 1 } },
  });

  const byDay = new Map<number, number[]>();
  const allValues: number[] = [];
  for (const job of allJobs) {
    const snapshot = job.engagementSnapshots[0];
    if (!snapshot) continue;
    const total = snapshot.likes + snapshot.comments + snapshot.shares;
    const day = gstDayOfWeek(job.updatedAt);
    byDay.set(day, [...(byDay.get(day) ?? []), total]);
    allValues.push(total);
  }
  if (allValues.length === 0) return null;
  const overallAvg = average(allValues);
  if (overallAvg === 0) return null;

  let best: { day: number; avg: number; sampleSize: number } | null = null;
  for (const [day, values] of byDay) {
    if (values.length < MIN_SAMPLE_SIZE) continue;
    const avg = average(values);
    if (!best || avg > best.avg) best = { day, avg, sampleSize: values.length };
  }
  if (!best || best.avg / overallAvg < 1.15) return null;

  return { kind: "day", dayIndex: best.day, ratio: best.avg / overallAvg, sampleSize: best.sampleSize };
}

export async function gatherWeeklyData(companyId: string, windowStart: Date, now: Date): Promise<WeeklyDigestData> {
  const [posterCount, videoCount, publishedCount, insight] = await Promise.all([
    db.poster.count({ where: { companyId, createdAt: { gte: windowStart, lt: now } } }),
    db.video.count({ where: { companyId, createdAt: { gte: windowStart, lt: now } } }),
    db.publishJob.count({ where: { companyId, status: "PUBLISHED", updatedAt: { gte: windowStart, lt: now } } }),
    computeInsight(companyId, windowStart, now),
  ]);

  return { generatedCount: posterCount + videoCount, publishedCount, insight };
}

export interface WeeklyDigestResult {
  sentCount: number;
  skippedCount: number;
}

// Real weekly email, reusing the existing Resend-backed sendEmail() —
// see src/lib/email.ts's own doc comment on the current sandbox-domain
// limitation (real arbitrary-recipient delivery needs a verified domain;
// this genuinely calls Resend and genuinely reports failure either way,
// never fakes success).
export async function sendWeeklyDigests(): Promise<WeeklyDigestResult> {
  const now = new Date();
  const defaultWindowStart = new Date(now.getTime() - WEEK_MS);
  const appUrl = getAppUrl();

  const companies = await db.company.findMany({
    where: { weeklyDigestEnabled: true, status: "ACTIVE" },
    include: {
      members: { where: { role: "OWNER" }, orderBy: { createdAt: "asc" }, take: 1, include: { user: true } },
    },
  });

  let sentCount = 0;
  let skippedCount = 0;

  for (const company of companies) {
    const owner = company.members[0]?.user;
    if (!owner) {
      skippedCount += 1;
      continue;
    }

    // A company that's never been sent one, or was somehow last sent
    // more than a week ago, still only ever reports the real trailing
    // week — never a backlog of "since forever" numbers dressed up as
    // "this week."
    const windowStart = company.lastWeeklyDigestSentAt && company.lastWeeklyDigestSentAt > defaultWindowStart
      ? company.lastWeeklyDigestSentAt
      : defaultWindowStart;

    const data = await gatherWeeklyData(company.id, windowStart, now);

    // Per spec: nothing meaningful happened this week -> don't send.
    // lastWeeklyDigestSentAt deliberately NOT advanced here, so a quiet
    // week doesn't shrink the real reporting window for whenever
    // activity actually resumes.
    if (data.generatedCount === 0 && data.publishedCount === 0) {
      skippedCount += 1;
      continue;
    }

    const html = buildWeeklyDigestHtml({
      companyName: company.name,
      locale: company.locale,
      data,
      studioUrl: `${appUrl}/studio`,
      unsubscribeUrl: `${appUrl}/digest-unsubscribe?company=${company.id}&token=${signUnsubscribeToken(company.id)}`,
    });

    try {
      await sendEmail({
        to: owner.email,
        subject: buildWeeklyDigestSubject(company.name, company.locale),
        html,
      });
      await db.company.update({ where: { id: company.id }, data: { lastWeeklyDigestSentAt: now } });
      sentCount += 1;
    } catch (error) {
      if (error instanceof EmailNotConfiguredError) {
        console.warn(`[weekly-digest] Email not configured — digest for company ${company.id} could not be delivered.`);
      } else {
        console.error(`[weekly-digest] sendEmail failed for company ${company.id}:`, error);
      }
      skippedCount += 1;
    }
  }

  return { sentCount, skippedCount };
}

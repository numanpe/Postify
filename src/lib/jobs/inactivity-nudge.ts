import "server-only";

import { db } from "@/lib/db";
import { sendEmail, EmailNotConfiguredError } from "@/lib/email";
import { signUnsubscribeToken } from "@/lib/unsubscribe-token";
import { buildNudgeHtml, buildNudgeSubject } from "@/lib/jobs/nudge-email";

// "Gone quiet" means no real content created (poster or video, not just
// published — the point is idle usage of the tool itself, not idle
// social accounts) in this many days. Chosen to be long enough that a
// real short break (a slow week, a holiday) doesn't trigger a nudge,
// short enough that it still catches genuine drop-off before it turns
// into churn.
const QUIET_THRESHOLD_DAYS = 14;
const QUIET_THRESHOLD_MS = QUIET_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;

function getAppUrl(): string {
  const url = process.env.APP_URL;
  if (!url) {
    throw new Error("APP_URL is not set — required to build inactivity-nudge links.");
  }
  return url.replace(/\/$/, "");
}

export interface InactivityNudgeResult {
  sentCount: number;
  skippedCount: number;
}

// Real, deliberately conservative send logic: only ever fires once per
// real quiet stretch (guarded by lastInactivityNudgeSentAt, the exact
// same "don't nag on every cron run" discipline weekly-digest.ts's own
// lastWeeklyDigestSentAt already established), and only for a company
// that genuinely has zero real Poster/Video rows in the whole window —
// never a fabricated "you've been quiet" claim when the company was
// actually active.
export async function sendInactivityNudges(now: Date = new Date()): Promise<InactivityNudgeResult> {
  const threshold = new Date(now.getTime() - QUIET_THRESHOLD_MS);
  const appUrl = getAppUrl();

  const companies = await db.company.findMany({
    where: { inactivityNudgeEnabled: true, status: "ACTIVE" },
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

    // A brand-new company that's never made anything at all is a
    // different, real state (onboarding friction, not "went quiet
    // after being active") — onboarding/help already addresses that
    // case; this feature is specifically for real drop-off after real
    // usage, so it requires at least one real prior creation.
    const [recentPoster, recentVideo, anyPosterEver, anyVideoEver] = await Promise.all([
      db.poster.findFirst({ where: { companyId: company.id, createdAt: { gte: threshold } }, select: { id: true } }),
      db.video.findFirst({ where: { companyId: company.id, createdAt: { gte: threshold } }, select: { id: true } }),
      db.poster.findFirst({ where: { companyId: company.id, createdAt: { lt: threshold } }, select: { id: true } }),
      db.video.findFirst({ where: { companyId: company.id, createdAt: { lt: threshold } }, select: { id: true } }),
    ]);

    const wentQuiet = !recentPoster && !recentVideo && (anyPosterEver || anyVideoEver);
    if (!wentQuiet) {
      skippedCount += 1;
      continue;
    }

    // Already nudged for this same quiet stretch — don't nag again
    // until either they come back (resetting the stretch) or another
    // full threshold has passed with them still quiet.
    if (company.lastInactivityNudgeSentAt && company.lastInactivityNudgeSentAt > threshold) {
      skippedCount += 1;
      continue;
    }

    const html = buildNudgeHtml({
      companyName: company.name,
      locale: company.locale,
      quietDays: QUIET_THRESHOLD_DAYS,
      studioUrl: `${appUrl}/studio`,
      unsubscribeUrl: `${appUrl}/digest-unsubscribe?type=nudge&company=${company.id}&token=${signUnsubscribeToken(company.id)}`,
    });

    try {
      await sendEmail({ to: owner.email, subject: buildNudgeSubject(company.name, company.locale), html });
      await db.company.update({ where: { id: company.id }, data: { lastInactivityNudgeSentAt: now } });
      sentCount += 1;
    } catch (error) {
      if (error instanceof EmailNotConfiguredError) {
        console.warn(`[inactivity-nudge] Email not configured — nudge for company ${company.id} could not be delivered.`);
      } else {
        console.error(`[inactivity-nudge] sendEmail failed for company ${company.id}:`, error);
      }
      skippedCount += 1;
    }
  }

  return { sentCount, skippedCount };
}

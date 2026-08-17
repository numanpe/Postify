import "server-only";

import { db } from "@/lib/db";

const DEFAULT_RETENTION_DAYS = 30;

function retentionDays(): number {
  const raw = process.env.MEDIA_RETENTION_DAYS;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_RETENTION_DAYS;
}

export interface FlagStaleMediaResult {
  flaggedCount: number;
  retentionDays: number;
}

// Task 3, point 3: flags — never deletes — media older than
// MEDIA_RETENTION_DAYS (default 30) that's neither been downloaded nor
// published. storageDeletedAt IS NULL implicitly excludes anything
// already published: both publish paths (campaign-publish.ts) call
// cleanupMediaStorage synchronously right after a confirmed success, so
// a published asset's file is already gone by the time this cron runs —
// no separate "was this published" query needed. Age is measured from
// retentionExtendedAt when a user has clicked "extend retention",
// otherwise from createdAt.
export async function flagStaleMedia(): Promise<FlagStaleMediaResult> {
  const days = retentionDays();
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const candidates = await db.mediaAsset.findMany({
    where: {
      storageDeletedAt: null,
      staleFlaggedAt: null,
      downloadedAt: null,
      OR: [
        { retentionExtendedAt: null, createdAt: { lt: cutoff } },
        { retentionExtendedAt: { lt: cutoff } },
      ],
    },
    select: { id: true },
  });

  if (candidates.length > 0) {
    await db.mediaAsset.updateMany({
      where: { id: { in: candidates.map((c) => c.id) } },
      data: { staleFlaggedAt: new Date() },
    });
  }

  return { flaggedCount: candidates.length, retentionDays: days };
}

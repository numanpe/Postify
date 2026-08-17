import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";

// Task 2 Option 1: "Download Asset & Copy Caption". Streams the real
// file to the browser and marks MediaAsset.downloadedAt — used only by
// the retention cron's "undownloaded" check. Deliberately does NOT call
// cleanupMediaStorage and does NOT touch PublishStatus/AggregatorPublishLog:
// downloading is never publishing confirmation, and the file must still
// exist for the version-history/audit trail regardless of how many times
// it's downloaded — see cleanupMediaStorage's doc comment for the strict
// trigger guarantee.
//
// Not routed through requireUser()/redirect() — see the identical note in
// src/app/api/storage/[...key]/route.ts.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return new NextResponse(null, { status: 401 });
  }

  const { id } = await params;
  const item = await db.campaignItem.findUnique({
    where: { id },
    include: { campaign: true, poster: { include: { asset: true } }, video: { include: { asset: true } } },
  });
  if (!item) {
    return new NextResponse(null, { status: 404 });
  }

  const membership = await db.companyMember.findFirst({
    where: { userId: session.user.id, companyId: item.campaign.companyId },
  });
  if (!membership) {
    return new NextResponse(null, { status: 403 });
  }

  const mediaAsset = item.poster?.asset ?? item.video?.asset;
  if (!mediaAsset || mediaAsset.storageDeletedAt) {
    return new NextResponse(null, { status: 404 });
  }

  const data = await storage.get(mediaAsset.storageKey);
  await db.mediaAsset.update({
    where: { id: mediaAsset.id },
    data: { downloadedAt: new Date(), staleFlaggedAt: null },
  });

  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": mediaAsset.mimeType,
      "Content-Disposition": `attachment; filename="${mediaAsset.fileName}"`,
    },
  });
}

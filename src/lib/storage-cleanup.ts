import "server-only";

import { db } from "@/lib/db";
import { storage } from "@/lib/storage";

// Deletes only the heavy file in storage — the MediaAsset row, its
// metadata, and every record that references it (Poster/Video captions,
// CampaignItem, AggregatorPublishLog) are left intact. This is the one
// deliberate divergence from deleteMedia (src/lib/actions/media.ts),
// which deletes both together; that action is for a user actively
// discarding an asset, this one is for reclaiming storage space after a
// confirmed publish while keeping the record/audit trail alive.
//
// STRICT TRIGGER GUARANTEE: call this ONLY after a verified successful
// publish response (a 200-equivalent confirmation from a Task 2 Option 2
// or Option 3 publish attempt). Never call this from a download handler
// — see the download route, which explicitly does not call this.
export async function cleanupMediaStorage(assetId: string): Promise<void> {
  const asset = await db.mediaAsset.findUnique({ where: { id: assetId } });
  if (!asset || asset.storageDeletedAt) return;

  await storage.delete(asset.storageKey);
  await db.mediaAsset.update({
    where: { id: assetId },
    data: { storageDeletedAt: new Date(), staleFlaggedAt: null },
  });
}

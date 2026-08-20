"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requireCompany } from "@/lib/session";
import { storage, buildStorageKey } from "@/lib/storage";
import { editVideo } from "@/lib/video/edit";
import { cleanupMediaStorage } from "@/lib/storage-cleanup";

export type EditVideoState = { error: string } | { success: true } | undefined;

// Task 3: "Edit Video" on a campaign card — trim and/or a burned-in text
// overlay, via the existing FFmpeg pipeline (src/lib/video/edit.ts).
//
// Storage-cleanup safety rule: this creates a brand-new MediaAsset for
// the edited file and only repoints Video.assetId to it — the OLD asset
// is never touched until db.video.update above has actually committed
// (awaited, no try/catch around it that could swallow a failure), and
// even then cleanupMediaStorage only deletes the old file from storage,
// never the DB row/history. A failed edit (ffmpeg error, storage
// failure) never reaches the old asset at all. Never triggered by a
// download — see src/app/api/campaign-items/[id]/download/route.ts.
export async function editCampaignItemVideo(
  itemId: string,
  _prevState: EditVideoState,
  formData: FormData,
): Promise<EditVideoState> {
  const { company } = await requireCompany();

  const item = await db.campaignItem.findFirst({
    where: { id: itemId, campaign: { companyId: company.id } },
    include: { video: { include: { asset: true } } },
  });
  if (!item?.video) {
    return { error: "This item has no video to edit." };
  }
  if (item.video.asset.storageDeletedAt) {
    return { error: "This video's file was already cleaned up after a confirmed publish." };
  }

  const trimStartRaw = formData.get("trimStart");
  const trimEndRaw = formData.get("trimEnd");
  const overlayTextRaw = formData.get("overlayText");

  const trimStartSec = trimStartRaw ? Number(trimStartRaw) : undefined;
  const trimEndSec = trimEndRaw ? Number(trimEndRaw) : undefined;
  const overlayText = typeof overlayTextRaw === "string" && overlayTextRaw.trim() ? overlayTextRaw.trim() : undefined;

  if (trimStartSec === undefined && trimEndSec === undefined && !overlayText) {
    return { error: "Set a trim range or add overlay text before saving." };
  }
  if (trimStartSec !== undefined && trimEndSec !== undefined && trimEndSec <= trimStartSec) {
    return { error: "Trim end must be after trim start." };
  }

  try {
    const sourceBuffer = await storage.get(item.video.asset.storageKey);
    const edited = await editVideo({
      sourceBuffer,
      width: item.video.asset.width ?? 1080,
      height: item.video.asset.height ?? 1080,
      trimStartSec,
      trimEndSec,
      overlayText,
    });

    const storageKey = buildStorageKey(company.id, `video-edit-${Date.now()}.mp4`);
    await storage.put(storageKey, edited.mp4);

    const newAsset = await db.mediaAsset.create({
      data: {
        companyId: company.id,
        storageKey,
        fileName: `video-edit-${Date.now()}.mp4`,
        mimeType: "video/mp4",
        sizeBytes: edited.mp4.byteLength,
        width: item.video.asset.width,
        height: item.video.asset.height,
        orientation: item.video.asset.orientation,
      },
    });

    const oldAssetId = item.video.asset.id;
    await db.video.update({ where: { id: item.video.id }, data: { assetId: newAsset.id } });

    // Only reachable once the reassignment above has actually committed
    // — see this function's doc comment.
    await cleanupMediaStorage(oldAssetId);

    revalidatePath(`/campaigns/${item.campaignId}`);
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Video edit failed." };
  }
}

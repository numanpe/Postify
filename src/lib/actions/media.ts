"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { requireCompany } from "@/lib/session";
import { createMediaAssetFromFile, MAX_FILE_SIZE_BYTES } from "@/lib/media";
import { recordSignal, fingerprintContent, SIGNAL_STRENGTH } from "@/lib/creative-dna/signals";
import { recomputeCreativeDnaPreferences } from "@/lib/creative-dna/aggregate";

export type UploadMediaState = { error: string } | undefined;

// The <input accept="..."> hint in the form is client-side only and
// trivially bypassed — this is the real check. Matches what the media
// pipeline actually knows how to handle: images go through sharp for
// dimensions, video/audio are stored as-is for the video engine's
// footage picker.
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "audio/mpeg",
  "audio/wav",
  "audio/mp4",
  "audio/ogg",
]);

export async function uploadMedia(
  _prevState: UploadMediaState,
  formData: FormData,
): Promise<UploadMediaState> {
  const { user, company } = await requireCompany();

  const files = formData
    .getAll("files")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (files.length === 0) {
    return { error: "Choose at least one file." };
  }

  for (const file of files) {
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return { error: `"${file.name}" isn't a supported file type (photos, videos, or audio only).` };
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return { error: `"${file.name}" is too large — the limit is 25MB per file.` };
    }
  }

  for (const file of files) {
    await createMediaAssetFromFile({
      companyId: company.id,
      uploadedById: user.id,
      file,
    });
  }

  // Media grid refresh happens client-side (upload-media-form.tsx's
  // router.refresh() on success) instead of here — see poster.ts's
  // identical change. deleteMedia below keeps revalidatePath: it's a
  // void action bound directly to a <form>, with no client component
  // able to trigger a refresh after it runs.
}

export async function deleteMedia(assetId: string): Promise<void> {
  const { company } = await requireCompany();

  // Ownership check: only delete assets that actually belong to the
  // caller's company, never trust the id alone.
  const asset = await db.mediaAsset.findFirst({
    where: { id: assetId, companyId: company.id },
    include: {
      posterOutput: { include: { campaignItem: { include: { campaign: true } } } },
      videoOutput: { include: { campaignItem: { include: { campaign: true } } } },
    },
  });
  if (!asset) return;

  // Deleting a poster/video's own image/video file from the Media
  // Library is a second real way to delete generated content, besides
  // removeCampaignItem — MediaAsset -> Poster/Video is onDelete:
  // Cascade (see PosterOutput/VideoOutput in schema.prisma), so this
  // delete is about to take the Poster/Video row down with it. Same
  // real negative signal (Part 1.2) as the campaign-item path, read
  // before the delete for the same reason.
  if (asset.posterOutput || asset.videoOutput) {
    const poster = asset.posterOutput;
    const video = asset.videoOutput;
    const campaignItem = poster?.campaignItem ?? video?.campaignItem;
    const generatedText = poster
      ? [poster.headline, poster.subhead, poster.cta].filter(Boolean).join(" ")
      : video?.topic;

    await recordSignal({
      companyId: company.id,
      sourceType: "DELETE",
      strength: SIGNAL_STRENGTH.DELETE,
      topic: campaignItem?.campaign.campaignType,
      template: poster?.template ?? video?.template,
      visualStyle: poster?.backgroundSource,
      posterId: poster?.id,
      videoId: video?.id,
      campaignItemId: campaignItem?.id,
      contentFingerprint: generatedText ? fingerprintContent(generatedText) : undefined,
    });
  }

  await db.mediaAsset.delete({ where: { id: asset.id } });
  await storage.delete(asset.storageKey);
  if (asset.posterOutput || asset.videoOutput) {
    await recomputeCreativeDnaPreferences(company.id);
  }

  revalidatePath("/media");
}

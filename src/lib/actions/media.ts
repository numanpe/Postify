"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { requireCompany } from "@/lib/session";
import { createMediaAssetFromFile } from "@/lib/media";

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

// Generous enough for real photos and short B-roll clips, bounded
// enough that one upload can't exhaust server memory or storage —
// createMediaAssetFromFile reads the whole file into memory before
// writing, so this is a real ceiling, not just a UX nicety.
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

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

  revalidatePath("/media");
}

export async function deleteMedia(assetId: string): Promise<void> {
  const { company } = await requireCompany();

  // Ownership check: only delete assets that actually belong to the
  // caller's company, never trust the id alone.
  const asset = await db.mediaAsset.findFirst({
    where: { id: assetId, companyId: company.id },
  });
  if (!asset) return;

  await db.mediaAsset.delete({ where: { id: asset.id } });
  await storage.delete(asset.storageKey);

  revalidatePath("/media");
}

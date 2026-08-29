import "server-only";
import sharp from "sharp";

import { db } from "@/lib/db";
import { storage, buildStorageKey } from "@/lib/storage";

// Shared with any upload entry point (Media Library's own form, the
// video Scene Editor's inline upload) so the real limit only lives in
// one place — createMediaAssetFromFile reads the whole file into memory
// before writing, so this is a real ceiling, not just a UX nicety.
export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

// Image/video only — the subset relevant to video scene media (no
// audio, unlike the general Media Library upload's full allow-list in
// src/lib/actions/media.ts).
export const ALLOWED_SCENE_MEDIA_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);

// Structural metadata only — mime type, dimensions, orientation. No AI
// involved. Semantic tags (subject/objects/people/category) require a
// vision provider, which doesn't exist until Phase 2's provider
// abstraction — don't fake them here.
export async function createMediaAssetFromFile(params: {
  companyId: string;
  uploadedById: string;
  file: File;
}) {
  const { companyId, uploadedById, file } = params;
  const buffer = Buffer.from(await file.arrayBuffer());
  const storageKey = buildStorageKey(companyId, file.name);

  let width: number | undefined;
  let height: number | undefined;
  let orientation: string | undefined;

  if (file.type.startsWith("image/")) {
    try {
      const metadata = await sharp(buffer).metadata();
      width = metadata.width;
      height = metadata.height;
      if (width && height) {
        orientation = width === height ? "square" : width > height ? "landscape" : "portrait";
      }
    } catch {
      // Not a decodable/corrupt image — still store the file, just
      // without dimension metadata, rather than rejecting the upload.
    }
  }

  await storage.put(storageKey, buffer);

  return db.mediaAsset.create({
    data: {
      companyId,
      uploadedById,
      storageKey,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: buffer.byteLength,
      width,
      height,
      orientation,
    },
  });
}

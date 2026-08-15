import "server-only";
import sharp from "sharp";

import { db } from "@/lib/db";
import { storage, buildStorageKey } from "@/lib/storage";

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

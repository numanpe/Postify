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

// Real, most-recent-first bound on every "pick from your library"
// selector — a company's usable media only grows over time (recurring
// plans generate content indefinitely), so an unbounded fetch here is
// the same real scalability risk pagination already closed for the
// main Media Library grid and Campaigns list.
const PICKABLE_MEDIA_ASSETS_LIMIT = 200;

export interface PickableMediaAsset {
  id: string;
  fileName: string;
  mimeType: string;
}

// Shared by every real "pick from your media" selector (poster
// background, video B-roll, video scene-swap) — five near-identical
// inline queries used to duplicate this exact filter across
// media/page.tsx, campaigns/[id]/page.tsx, studio/design/page.tsx, and
// studio/[mode]/page.tsx, which is exactly how a real bug shipped: the
// two photo-only pickers never got the storageDeletedAt exclusion the
// other three already had, so a photo cleaned up by
// cleanupMediaStorage could still be picked and render broken. One
// shared function now, not five copies that can silently drift apart
// again.
export async function getPickableMediaAssets(
  companyId: string,
  { includeVideo }: { includeVideo: boolean },
): Promise<PickableMediaAsset[]> {
  return db.mediaAsset.findMany({
    where: {
      companyId,
      // Never offer a generated poster/video's own output, or the
      // brand logo, back as raw material for a new one — see Phase 3's
      // photo-picker fix and CLAUDE.md's authenticity rule against
      // synthetic-on-synthetic output.
      posterOutput: null,
      videoOutput: null,
      brandKitLogo: null,
      // A re-rendered/edited video reassigns Video.assetId away from
      // its old asset, which makes videoOutput null again even though
      // the real file was deleted (cleanupMediaStorage) —
      // storageDeletedAt is the real signal an asset is actually gone,
      // not "currently unused."
      storageDeletedAt: null,
      OR: includeVideo
        ? [{ mimeType: { startsWith: "image/" } }, { mimeType: { startsWith: "video/" } }]
        : [{ mimeType: { startsWith: "image/" } }],
    },
    orderBy: { createdAt: "desc" },
    take: PICKABLE_MEDIA_ASSETS_LIMIT,
    select: { id: true, fileName: true, mimeType: true },
  });
}

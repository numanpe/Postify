import "server-only";
import { readFile } from "node:fs/promises";
import sharp from "sharp";

import { storage, buildStorageKey } from "@/lib/storage";
import { runFfmpeg, probeMedia } from "./ffmpeg";
import { withScratchDir, writeScratchFile } from "./scratch";
import type { SceneKind } from "./render";

// Real scene thumbnails for the visual editor strip — generated once,
// at the exact moment a scene's real buffer already exists in memory
// (initial generation in generate.ts, or a re-render in
// scene-editor.ts), never lazily during a page render. Two real
// reasons this matters, not just style: (1) a Server Component render
// is a GET — writing a derived MediaAsset/storageKey as a side effect
// of rendering is the kind of thing Next can re-run or dedupe
// unpredictably, so mutations belong in the Server Action/generation
// path that already owns this write; (2) capturing the thumbnail from
// the scene's own clean, pre-composited buffer (the real uploaded
// photo, the real uploaded video's own frame, or the real freshly
// generated AI image) is honestly more representative than extracting
// a frame from the FINAL video, which has captions/logo/transitions
// already burned in over it.
//
// REAL_PHOTO scenes need no thumbnail at all — the real uploaded
// photo already IS a displayable image; callers should just use
// mediaAsset.storageKey directly. Only REAL_VIDEO (needs a single
// extracted frame — video buffers aren't directly displayable) and
// AI_STILL (the generated image itself, just re-encoded small) call
// this.
const THUMBNAIL_WIDTH = 320;

export async function generateImageThumbnail(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer).resize(THUMBNAIL_WIDTH, null, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
}

export async function generateVideoThumbnail(buffer: Buffer): Promise<Buffer> {
  return withScratchDir(async (dir) => {
    const sourcePath = await writeScratchFile(dir, "source.mp4", buffer);
    const probe = await probeMedia(sourcePath);
    // A representative frame, not a frame-accurate one — 1s in (or the
    // real clip's own midpoint if it's shorter than 2s) reliably skips
    // a black/fade-in first frame without needing per-video tuning.
    const offsetSec = Math.min(1, Math.max(0, probe.durationSec / 2));
    const outPath = `${dir}/thumb.jpg`;
    await runFfmpeg([
      "-ss",
      offsetSec.toFixed(2),
      "-i",
      sourcePath,
      "-frames:v",
      "1",
      "-vf",
      `scale=${THUMBNAIL_WIDTH}:-1`,
      "-q:v",
      "4",
      outPath,
    ]);
    return readFile(outPath);
  });
}

// Shared by generate.ts (initial generation) and scene-editor.ts (every
// re-render path) — the one real place a scene's thumbnail gets
// captured, from the scene's own clean buffer at the exact moment it's
// finalized. REAL_PHOTO returns null deliberately (see this file's
// top-of-file note): the real uploaded photo is already a displayable
// image, so storing a second derived copy would just be waste.
export async function captureSceneThumbnail(
  companyId: string,
  kind: SceneKind,
  buffer: Buffer,
  mimeType: string,
): Promise<string | null> {
  if (kind === "REAL_PHOTO") return null;
  const thumbnailBuffer =
    kind === "REAL_VIDEO" || mimeType.startsWith("video/")
      ? await generateVideoThumbnail(buffer)
      : await generateImageThumbnail(buffer);
  const key = buildStorageKey(companyId, `scene-thumb-${Date.now()}.jpg`);
  await storage.put(key, thumbnailBuffer);
  return key;
}

// The read-side counterpart — resolves whichever real image a given
// scene should actually display: the real uploaded photo for
// REAL_PHOTO (no separate thumbnail exists for that kind, see above),
// or the captured thumbnail for REAL_VIDEO/AI_STILL. Returns null,
// never a placeholder guess, for a scene from before this feature
// existed (or a rare capture failure) — callers show a real "no
// preview yet" state rather than a fake image.
export function resolveSceneThumbnailUrl(scene: {
  kind: SceneKind;
  mediaAsset: { storageKey: string } | null;
  thumbnailStorageKey: string | null;
}): string | null {
  if (scene.kind === "REAL_PHOTO" && scene.mediaAsset) return storage.url(scene.mediaAsset.storageKey);
  if (scene.thumbnailStorageKey) return storage.url(scene.thumbnailStorageKey);
  return null;
}

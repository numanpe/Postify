"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requireCompany } from "@/lib/session";
import { storage, buildStorageKey } from "@/lib/storage";
import { createMediaAssetFromFile, ALLOWED_SCENE_MEDIA_MIME_TYPES, MAX_FILE_SIZE_BYTES } from "@/lib/media";
import { editVideo } from "@/lib/video/edit";
import { cleanupMediaStorage } from "@/lib/storage-cleanup";
import {
  editNarratedVideoScript,
  swapNarratedVideoSceneMedia,
  editNonNarratedVideoScenes,
  VideoEditError,
  type EditableSceneInput,
} from "@/lib/video/scene-editor";
import type { VideoScriptSections } from "@/lib/providers/text/types";

export type EditVideoState = { error: string } | { success: true } | undefined;

async function revalidateVideoViews(videoId: string) {
  const video = await db.video.findUnique({
    where: { id: videoId },
    select: { campaignItem: { select: { campaignId: true } } },
  });
  revalidatePath("/studio/video");
  if (video?.campaignItem) revalidatePath(`/campaigns/${video.campaignItem.campaignId}`);
}

// Trim and/or a burned-in text overlay, via the existing FFmpeg pipeline
// (src/lib/video/edit.ts). Re-scoped from CampaignItem to Video directly
// (was editCampaignItemVideo(itemId, ...)) — the script/scene editor
// below needs company-scoped Video ownership regardless of whether a
// CampaignItem wraps it (standalone Studio videos never have one), so
// this now shares that same real ownership check instead of the whole
// modal needing two different lookup paths for the same video.
//
// Storage-cleanup safety rule: this creates a brand-new MediaAsset for
// the edited file and only repoints Video.assetId to it — the OLD asset
// is never touched until db.video.update above has actually committed
// (awaited, no try/catch around it that could swallow a failure), and
// even then cleanupMediaStorage only deletes the old file from storage,
// never the DB row/history. A failed edit (ffmpeg error, storage
// failure) never reaches the old asset at all. Never triggered by a
// download — see src/app/api/campaign-items/[id]/download/route.ts.
export async function editVideoAsset(
  videoId: string,
  _prevState: EditVideoState,
  formData: FormData,
): Promise<EditVideoState> {
  const { company } = await requireCompany();

  const video = await db.video.findFirst({
    where: { id: videoId, companyId: company.id },
    include: { asset: true },
  });
  if (!video) {
    return { error: "This video no longer exists." };
  }
  if (video.asset.storageDeletedAt) {
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
    const sourceBuffer = await storage.get(video.asset.storageKey);
    const edited = await editVideo({
      sourceBuffer,
      width: video.asset.width ?? 1080,
      height: video.asset.height ?? 1080,
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
        width: video.asset.width,
        height: video.asset.height,
        orientation: video.asset.orientation,
      },
    });

    const oldAssetId = video.asset.id;
    await db.video.update({ where: { id: video.id }, data: { assetId: newAsset.id } });

    // Only reachable once the reassignment above has actually committed
    // — see this function's doc comment.
    await cleanupMediaStorage(oldAssetId);

    await revalidateVideoViews(video.id);
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Video edit failed." };
  }
}

export type EditScriptState = { error: string } | { success: true } | undefined;

const SCRIPT_KEYS = ["hook", "context", "value", "message", "cta"] as const;

// Narrated videos only — full re-render (new narration, new timing, new
// composite). Empty section text removes that scene from the re-render.
export async function editVideoScript(
  videoId: string,
  _prevState: EditScriptState,
  formData: FormData,
): Promise<EditScriptState> {
  const { company } = await requireCompany();

  const newScript = {} as VideoScriptSections;
  for (const key of SCRIPT_KEYS) {
    const raw = formData.get(key);
    newScript[key] = typeof raw === "string" ? raw.trim() : "";
  }

  try {
    await editNarratedVideoScript(videoId, company.id, newScript);
    await revalidateVideoViews(videoId);
    return { success: true };
  } catch (error) {
    if (error instanceof VideoEditError) return { error: error.message };
    return { error: error instanceof Error ? error.message : "Could not re-render this video." };
  }
}

export type SwapSceneMediaState = { error: string } | { success: true } | undefined;

// Narrated videos: swap one scene's media, script text unchanged (still
// a near-full re-render — see scene-editor.ts's own notes on why).
export async function swapVideoSceneMedia(
  videoId: string,
  sceneScriptKey: string,
  _prevState: SwapSceneMediaState,
  formData: FormData,
): Promise<SwapSceneMediaState> {
  const { company } = await requireCompany();

  const assetId = formData.get("assetId");
  const regenerateAi = formData.get("regenerateAi") === "true";

  if (!regenerateAi && (typeof assetId !== "string" || !assetId)) {
    return { error: "Choose a photo/video, or generate a new AI background." };
  }

  try {
    await swapNarratedVideoSceneMedia(
      videoId,
      company.id,
      sceneScriptKey,
      regenerateAi ? { regenerateAi: true } : { assetId: assetId as string },
    );
    await revalidateVideoViews(videoId);
    return { success: true };
  } catch (error) {
    if (error instanceof VideoEditError) return { error: error.message };
    return { error: error instanceof Error ? error.message : "Could not re-render this video." };
  }
}

export type UploadSceneMediaState =
  | { error: string }
  | { assetId: string; fileName: string; mimeType: string }
  | undefined;

// Inline "upload a new photo/video" from the Scene Editor's swap picker
// (video-edit-modal.tsx's SceneMediaSwapButton) — reuses the exact same
// createMediaAssetFromFile real upload path as Media Library's own
// upload form (src/lib/actions/media.ts), so the result is an ordinary
// company-scoped MediaAsset row, indistinguishable from one picked out
// of the library. Deliberately does NOT touch swapVideoSceneMedia /
// editVideoScenes below — the caller treats the returned assetId
// exactly like an existing-asset pick, so neither of those needs to
// know a fresh upload happened.
export async function uploadSceneMediaAsset(
  _prevState: UploadSceneMediaState,
  formData: FormData,
): Promise<UploadSceneMediaState> {
  const { user, company } = await requireCompany();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a photo or video to upload." };
  }
  if (!ALLOWED_SCENE_MEDIA_MIME_TYPES.has(file.type)) {
    return { error: `"${file.name}" isn't a supported file type (photos or videos only).` };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { error: `"${file.name}" is too large — the limit is 25MB.` };
  }

  const asset = await createMediaAssetFromFile({ companyId: company.id, uploadedById: user.id, file });
  return { assetId: asset.id, fileName: asset.fileName, mimeType: asset.mimeType };
}

export type EditScenesState = { error: string } | { success: true } | undefined;

// Non-narrated (free-tier) videos: reorder / duration / add / remove /
// swap / overlay-text — the client component serializes the full edited
// scene list as JSON (a plain form can't express an ordered,
// heterogeneous list of edits cleanly) into one hidden field.
export async function editVideoScenes(
  videoId: string,
  _prevState: EditScenesState,
  formData: FormData,
): Promise<EditScenesState> {
  const { company } = await requireCompany();

  const raw = formData.get("scenes");
  if (typeof raw !== "string") {
    return { error: "No scene changes to save." };
  }

  let editedScenes: EditableSceneInput[];
  try {
    editedScenes = JSON.parse(raw);
  } catch {
    return { error: "Could not read the scene changes." };
  }

  try {
    await editNonNarratedVideoScenes(videoId, company.id, editedScenes);
    await revalidateVideoViews(videoId);
    return { success: true };
  } catch (error) {
    if (error instanceof VideoEditError) return { error: error.message };
    return { error: error instanceof Error ? error.message : "Could not re-render this video." };
  }
}

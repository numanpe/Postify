import "server-only";

import type { AspectRatio, Prisma, SceneKind as PrismaSceneKind, VideoTemplate } from "@prisma/client";

import { db } from "@/lib/db";
import { getCompanyContext } from "@/lib/company-context";
import type { Industry } from "@/lib/industries";
import { storage, buildStorageKey } from "@/lib/storage";
import { cleanupMediaStorage } from "@/lib/storage-cleanup";
import { getVoiceProviderForCompany } from "@/lib/providers/voice/resolver";
import { getAiImageProviderForCompany } from "@/lib/providers/image/resolver";
import { VoiceProviderError } from "@/lib/providers/voice/types";
import { ImageProviderError } from "@/lib/providers/image/types";
import { getMusicForIndustry } from "@/lib/video/music";
import { renderVideo, type VideoSceneInput, type SceneKind } from "@/lib/video/render";
import {
  computeSectionTimingsFromWords,
  computeSectionTimingsFromDurations,
  SCRIPT_SECTION_KEYS,
  type SectionTiming,
} from "@/lib/video/timeline";
import { POSTER_DIMENSIONS } from "@/lib/poster/dimensions";
import type { VideoScriptSections } from "@/lib/providers/text/types";

export class VideoEditError extends Error {}

// A scene can't shrink to nothing or balloon past what's still a real
// short-form video for the target platforms this app publishes to
// (Reels/TikTok/Shorts-adjacent) — matches the spirit of the original
// pipeline's own FALLBACK_SECTION_DURATION_SEC (4.5s) as a sane middle,
// not an arbitrary new number.
export const MIN_SCENE_DURATION_SEC = 1.5;
export const MAX_SCENE_DURATION_SEC = 10;
export const MAX_TOTAL_DURATION_SEC = 90;
export const MAX_SCENES = 10;

interface LoadedScene {
  id: string;
  order: number;
  kind: PrismaSceneKind;
  mediaAssetId: string | null;
  mediaAsset: { id: string; storageKey: string; mimeType: string } | null;
  scriptKey: string | null;
  durationSec: number | null;
  overlayText: string | null;
}

interface LoadedVideo {
  id: string;
  companyId: string;
  assetId: string;
  topic: string;
  script: VideoScriptSections;
  aspectRatio: AspectRatio;
  template: VideoTemplate;
  hasNarration: boolean;
  scenes: LoadedScene[];
}

// Company-scoped ownership check lives here once — every export below
// calls this first, same as every other real action in this app scopes
// through requireCompany()'s company.id rather than trusting a caller-
// supplied id alone.
async function loadEditableVideo(videoId: string, companyId: string): Promise<LoadedVideo> {
  const video = await db.video.findFirst({
    where: { id: videoId, companyId },
    include: {
      asset: { select: { storageDeletedAt: true } },
      scenes: {
        include: { mediaAsset: { select: { id: true, storageKey: true, mimeType: true } } },
        orderBy: { order: "asc" },
      },
    },
  });
  if (!video) throw new VideoEditError("Video not found.");
  if (video.asset.storageDeletedAt) {
    throw new VideoEditError("This video's file was already cleaned up after a confirmed publish.");
  }
  return video as unknown as LoadedVideo;
}

async function fetchRealAssetBuffer(storageKey: string): Promise<Buffer> {
  return storage.get(storageKey);
}

interface RenderContext {
  companyId: string;
  aspectRatio: AspectRatio;
  template: VideoTemplate;
  companyLocale: "EN" | "AR";
  companyName: string;
  industry: Industry;
  tone: string;
}

async function buildRenderContext(companyId: string, video: LoadedVideo): Promise<RenderContext> {
  const context = await getCompanyContext(companyId);
  return {
    companyId,
    aspectRatio: video.aspectRatio,
    template: video.template,
    companyLocale: context.locale,
    companyName: context.name,
    industry: context.industry,
    tone: context.tone,
  };
}

async function fetchMusicAndLogo(companyId: string, industry: Industry) {
  const [musicBuffer, brandKit] = await Promise.all([
    getMusicForIndustry(industry),
    db.brandKit.findUnique({ where: { companyId }, include: { logoAsset: true } }),
  ]);
  const logoBuffer = brandKit?.logoAsset ? await storage.get(brandKit.logoAsset.storageKey) : null;
  return { musicBuffer, logoBuffer, brandAccentColor: brandKit?.accentColor };
}

interface ScenePlan {
  section: SectionTiming;
  kind: SceneKind;
  buffer: Buffer;
  mimeType: string;
  // Persisted alongside the render — mediaAssetId/scriptKey/durationSec/
  // overlayText per the VideoScene row this plan becomes.
  mediaAssetId: string | null;
  scriptKey: string | null;
  durationSec: number | null;
  overlayText: string | null;
}

async function persistRender(
  video: { id: string; companyId: string; assetId: string },
  rendered: Awaited<ReturnType<typeof renderVideo>>,
  scenePlans: ScenePlan[],
  scriptUpdate?: VideoScriptSections,
) {
  const storageKey = buildStorageKey(video.companyId, `video-edit-${Date.now()}.mp4`);
  await storage.put(storageKey, rendered.mp4);

  const orientation =
    rendered.width === rendered.height ? "square" : rendered.width > rendered.height ? "landscape" : "portrait";

  const newAsset = await db.mediaAsset.create({
    data: {
      companyId: video.companyId,
      storageKey,
      fileName: `video-edit-${Date.now()}.mp4`,
      mimeType: "video/mp4",
      sizeBytes: rendered.mp4.byteLength,
      width: rendered.width,
      height: rendered.height,
      orientation,
    },
  });

  const oldAssetId = video.assetId;

  await db.videoScene.deleteMany({ where: { videoId: video.id } });
  await db.video.update({
    where: { id: video.id },
    data: {
      assetId: newAsset.id,
      ...(scriptUpdate ? { script: scriptUpdate as unknown as Prisma.InputJsonValue } : {}),
      scenes: {
        create: scenePlans.map((plan, i) => ({
          order: i,
          kind: plan.kind,
          mediaAssetId: plan.mediaAssetId,
          scriptKey: plan.scriptKey,
          durationSec: plan.durationSec,
          overlayText: plan.overlayText,
        })),
      },
    },
  });

  // Only reachable once the reassignment above has actually committed —
  // same safety rule editCampaignItemVideo (video-edit.ts) already
  // established for this exact "supersede the old rendered file"
  // situation.
  await cleanupMediaStorage(oldAssetId);

  const failMessages = rendered.qualityGate.issues
    .filter((issue) => issue.severity === "fail")
    .map((issue) => issue.message);
  if (!rendered.qualityGate.passed) {
    throw new VideoEditError(`Quality check failed on the re-render: ${failMessages.join(" ")}`);
  }
  const warnings = rendered.qualityGate.issues
    .filter((issue) => issue.severity === "warning")
    .map((issue) => issue.message);

  return { videoId: video.id, warnings };
}

// Builds a VideoScriptSections-shaped object for RenderVideoInput.script
// out of real scene text — only used by the non-narrated scene editor,
// where scenes aren't tied to the 5 fixed keys anymore. This value only
// feeds two real, non-critical things downstream (render.ts's
// LOWER_THIRD_PROMO banner text lookup by "hook"/"cta" key, and the
// quality gate's locale/script check on the combined text) — never
// caption timing/content, which comes from each scene's own real
// section text passed separately. First scene -> hook, last -> cta (a
// reasonable reading for the banner template), remainder folded into
// context/value/message; unused keys are empty strings, which is safe
// since the quality gate only needs SOME real text present.
function synthesizeScriptForRender(scenes: { text: string }[]): VideoScriptSections {
  const keys = SCRIPT_SECTION_KEYS;
  const result: VideoScriptSections = { hook: "", context: "", value: "", message: "", cta: "" };
  scenes.forEach((scene, i) => {
    const key = i < keys.length - 1 ? keys[i] : keys[keys.length - 1];
    result[key] = result[key] ? `${result[key]} ${scene.text}` : scene.text;
  });
  return result;
}

// ---------------------------------------------------------------------
// Narrated (BYOK) videos: script editing + media swap only. Both are
// really the same operation underneath — re-synthesize narration (never
// persisted, so this always happens regardless of what changed — see
// this session's own performance-review notes), re-time every scene
// against the real new word timestamps, re-render, re-composite. Real,
// not fake: this is why the UI must say "this re-renders the whole
// video," not imply a quick patch.
// ---------------------------------------------------------------------

async function reRenderNarratedVideo(
  companyId: string,
  video: LoadedVideo,
  newScript: VideoScriptSections,
  mediaOverride?: { scriptKey: string; kind: SceneKind; buffer: Buffer; mimeType: string; mediaAssetId: string | null },
): Promise<{ videoId: string; warnings: string[] }> {
  const activeKeys = SCRIPT_SECTION_KEYS.filter((key) => newScript[key].trim());
  if (activeKeys.length === 0) {
    throw new VideoEditError("A narrated video needs at least one script section with real text.");
  }

  const voiceProvider = await getVoiceProviderForCompany(companyId);
  if (!voiceProvider) {
    throw new VideoEditError(
      "Add an OpenAI or ElevenLabs key in Settings, or switch back to the free voice engine.",
    );
  }
  const fullScriptText = activeKeys.map((key) => newScript[key]).join(" ... ");
  let narrationBuffer: Buffer;
  let narrationWords;
  try {
    const narrationResult = await voiceProvider.generateNarration({ text: fullScriptText });
    narrationBuffer = narrationResult.audioBuffer;
    narrationWords = narrationResult.words;
  } catch (error) {
    if (error instanceof VoiceProviderError) {
      throw new VideoEditError(`${error.providerName}: ${error.message}`);
    }
    throw error;
  }

  const sectionTimings = computeSectionTimingsFromWords(newScript, narrationWords);
  const totalDurationSec = sectionTimings[sectionTimings.length - 1].endSec;

  const renderCtx = await buildRenderContext(companyId, video);
  const { width, height } = POSTER_DIMENSIONS[video.aspectRatio];
  const imageProvider = await getAiImageProviderForCompany(companyId);

  const existingByKey = new Map(video.scenes.filter((s) => s.scriptKey).map((s) => [s.scriptKey as string, s]));

  const scenePlans: ScenePlan[] = [];
  for (const section of sectionTimings) {
    if (mediaOverride && section.key === mediaOverride.scriptKey) {
      scenePlans.push({
        section,
        kind: mediaOverride.kind,
        buffer: mediaOverride.buffer,
        mimeType: mediaOverride.mimeType,
        mediaAssetId: mediaOverride.mediaAssetId,
        scriptKey: section.key,
        durationSec: null,
        overlayText: null,
      });
      continue;
    }

    const existing = existingByKey.get(section.key);
    if (existing?.mediaAssetId && existing.mediaAsset) {
      // Real, unchanged media — cheap, exact re-fetch.
      const buffer = await fetchRealAssetBuffer(existing.mediaAsset.storageKey);
      scenePlans.push({
        section,
        kind: existing.kind as SceneKind,
        buffer,
        mimeType: existing.mediaAsset.mimeType,
        mediaAssetId: existing.mediaAssetId,
        scriptKey: section.key,
        durationSec: null,
        overlayText: null,
      });
      continue;
    }

    // Either this scene was AI_STILL (never persisted — real, disclosed
    // limitation, see this feature's design notes) or it's a
    // newly-reintroduced section with no prior scene to reuse. Both
    // cases need a fresh generation.
    if (!imageProvider) {
      throw new VideoEditError(
        `No saved photo/video exists for "${section.key}" and no AI image provider is configured — add one in Settings, or choose a real photo/video for this scene instead.`,
      );
    }
    try {
      const result = await imageProvider.generateBackground({
        companyName: renderCtx.companyName,
        industry: renderCtx.industry,
        tone: renderCtx.tone,
        topic: section.text,
        widthPx: width,
        heightPx: height,
      });
      scenePlans.push({
        section,
        kind: "AI_STILL",
        buffer: result.buffer,
        mimeType: result.mimeType,
        mediaAssetId: null,
        scriptKey: section.key,
        durationSec: null,
        overlayText: null,
      });
    } catch (error) {
      if (error instanceof ImageProviderError) {
        throw new VideoEditError(`${error.providerName}: ${error.message}`);
      }
      throw error;
    }
  }

  const { musicBuffer, logoBuffer, brandAccentColor } = await fetchMusicAndLogo(companyId, renderCtx.industry);

  const rendered = await renderVideo({
    scenes: scenePlans.map(({ section, kind, buffer, mimeType }) => ({ section, kind, buffer, mimeType })),
    aspectRatio: video.aspectRatio,
    logoBuffer,
    narrationBuffer,
    narrationWords,
    musicBuffer,
    totalDurationSec,
    script: newScript,
    companyLocale: renderCtx.companyLocale,
    template: video.template,
    companyName: renderCtx.companyName,
    brandAccentColor,
  });

  return persistRender(video, rendered, scenePlans, newScript);
}

// Public: edit a narrated video's script text. Empty section text
// removes that scene from the re-render (see timeline.ts).
export async function editNarratedVideoScript(
  videoId: string,
  companyId: string,
  newScript: VideoScriptSections,
): Promise<{ videoId: string; warnings: string[] }> {
  const video = await loadEditableVideo(videoId, companyId);
  if (!video.hasNarration) {
    throw new VideoEditError("This video has no narration — edit its scenes directly instead.");
  }
  return reRenderNarratedVideo(companyId, video, newScript);
}

// Public: swap ONE scene's media on a narrated video, script text
// unchanged. Still a near-full re-render underneath (narration isn't
// persisted) — see this module's own top-of-file notes.
export async function swapNarratedVideoSceneMedia(
  videoId: string,
  companyId: string,
  sceneScriptKey: string,
  media: { assetId: string } | { regenerateAi: true },
): Promise<{ videoId: string; warnings: string[] }> {
  const video = await loadEditableVideo(videoId, companyId);
  if (!video.hasNarration) {
    throw new VideoEditError("This video has no narration — edit its scenes directly instead.");
  }

  let override: { scriptKey: string; kind: SceneKind; buffer: Buffer; mimeType: string; mediaAssetId: string | null };
  if ("assetId" in media) {
    const asset = await db.mediaAsset.findFirst({ where: { id: media.assetId, companyId } });
    if (!asset) throw new VideoEditError("That photo/video could not be found.");
    const buffer = await storage.get(asset.storageKey);
    const kind: SceneKind = asset.mimeType.startsWith("video/") ? "REAL_VIDEO" : "REAL_PHOTO";
    override = { scriptKey: sceneScriptKey, kind, buffer, mimeType: asset.mimeType, mediaAssetId: asset.id };
  } else {
    const renderCtx = await buildRenderContext(companyId, video);
    const imageProvider = await getAiImageProviderForCompany(companyId);
    if (!imageProvider) {
      throw new VideoEditError("Add an OpenAI key in Settings to generate a new AI background for this scene.");
    }
    const { width, height } = POSTER_DIMENSIONS[video.aspectRatio];
    const sectionText = video.script[sceneScriptKey as keyof VideoScriptSections] ?? video.topic;
    try {
      const result = await imageProvider.generateBackground({
        companyName: renderCtx.companyName,
        industry: renderCtx.industry,
        tone: renderCtx.tone,
        topic: sectionText,
        widthPx: width,
        heightPx: height,
      });
      override = {
        scriptKey: sceneScriptKey,
        kind: "AI_STILL",
        buffer: result.buffer,
        mimeType: result.mimeType,
        mediaAssetId: null,
      };
    } catch (error) {
      if (error instanceof ImageProviderError) throw new VideoEditError(`${error.providerName}: ${error.message}`);
      throw error;
    }
  }

  return reRenderNarratedVideo(companyId, video, video.script, override);
}

// ---------------------------------------------------------------------
// Non-narrated (free-tier) videos: the full scene editor — reorder,
// duration, add/remove, media swap, overlay-text edits. Safe because
// there's no real narration audio for any of this to desync from.
// ---------------------------------------------------------------------

export interface EditableSceneInput {
  // Existing VideoScene id to keep reusing its media, or omitted for a
  // brand-new scene.
  existingSceneId?: string;
  // Omit to keep the scene's current media untouched. Provide to swap
  // it (a real asset id) or regenerate an AI background for it.
  media?: { assetId: string } | { regenerateAi: true };
  durationSec: number;
  overlayText: string;
}

export async function editNonNarratedVideoScenes(
  videoId: string,
  companyId: string,
  editedScenes: EditableSceneInput[],
): Promise<{ videoId: string; warnings: string[] }> {
  const video = await loadEditableVideo(videoId, companyId);
  if (video.hasNarration) {
    throw new VideoEditError("This video has narration — reorder/duration aren't safe here; edit its script instead.");
  }
  if (editedScenes.length === 0) {
    throw new VideoEditError("A video needs at least one scene.");
  }
  if (editedScenes.length > MAX_SCENES) {
    throw new VideoEditError(`A video can have at most ${MAX_SCENES} scenes.`);
  }
  for (const scene of editedScenes) {
    if (scene.durationSec < MIN_SCENE_DURATION_SEC || scene.durationSec > MAX_SCENE_DURATION_SEC) {
      throw new VideoEditError(
        `Each scene must be between ${MIN_SCENE_DURATION_SEC}s and ${MAX_SCENE_DURATION_SEC}s.`,
      );
    }
    if (!scene.overlayText.trim()) {
      throw new VideoEditError("Every scene needs on-screen text.");
    }
  }
  const totalDurationRequested = editedScenes.reduce((sum, s) => sum + s.durationSec, 0);
  if (totalDurationRequested > MAX_TOTAL_DURATION_SEC) {
    throw new VideoEditError(`The total video length can't exceed ${MAX_TOTAL_DURATION_SEC}s.`);
  }

  const renderCtx = await buildRenderContext(companyId, video);
  const { width, height } = POSTER_DIMENSIONS[video.aspectRatio];
  const existingById = new Map(video.scenes.map((s) => [s.id, s]));

  const scenePlans: ScenePlan[] = [];
  for (const edited of editedScenes) {
    const existing = edited.existingSceneId ? existingById.get(edited.existingSceneId) : undefined;

    let kind: SceneKind;
    let buffer: Buffer;
    let mimeType: string;
    let mediaAssetId: string | null;

    if (edited.media && "assetId" in edited.media) {
      const asset = await db.mediaAsset.findFirst({ where: { id: edited.media.assetId, companyId } });
      if (!asset) throw new VideoEditError("A selected photo/video could not be found.");
      buffer = await storage.get(asset.storageKey);
      mimeType = asset.mimeType;
      kind = asset.mimeType.startsWith("video/") ? "REAL_VIDEO" : "REAL_PHOTO";
      mediaAssetId = asset.id;
    } else if (edited.media && "regenerateAi" in edited.media) {
      const imageProvider = await getAiImageProviderForCompany(companyId);
      if (!imageProvider) {
        throw new VideoEditError("Add an OpenAI key in Settings to generate an AI background for this scene.");
      }
      try {
        const result = await imageProvider.generateBackground({
          companyName: renderCtx.companyName,
          industry: renderCtx.industry,
          tone: renderCtx.tone,
          topic: edited.overlayText,
          widthPx: width,
          heightPx: height,
        });
        buffer = result.buffer;
        mimeType = result.mimeType;
        kind = "AI_STILL";
        mediaAssetId = null;
      } catch (error) {
        if (error instanceof ImageProviderError) throw new VideoEditError(`${error.providerName}: ${error.message}`);
        throw error;
      }
    } else if (existing?.mediaAssetId && existing.mediaAsset) {
      buffer = await fetchRealAssetBuffer(existing.mediaAsset.storageKey);
      mimeType = existing.mediaAsset.mimeType;
      kind = existing.kind as SceneKind;
      mediaAssetId = existing.mediaAssetId;
    } else if (existing?.kind === "AI_STILL") {
      // Unchanged AI-still scene — never persisted, real disclosed
      // limitation (see this module's top-of-file notes): regenerate
      // fresh rather than silently drop the scene.
      const imageProvider = await getAiImageProviderForCompany(companyId);
      if (!imageProvider) {
        throw new VideoEditError(
          "This scene's AI background wasn't saved and no AI image provider is configured anymore — choose a real photo/video for it instead.",
        );
      }
      try {
        const result = await imageProvider.generateBackground({
          companyName: renderCtx.companyName,
          industry: renderCtx.industry,
          tone: renderCtx.tone,
          topic: edited.overlayText,
          widthPx: width,
          heightPx: height,
        });
        buffer = result.buffer;
        mimeType = result.mimeType;
        kind = "AI_STILL";
        mediaAssetId = null;
      } catch (error) {
        if (error instanceof ImageProviderError) throw new VideoEditError(`${error.providerName}: ${error.message}`);
        throw error;
      }
    } else {
      throw new VideoEditError("Choose a photo/video (or generate an AI background) for every scene.");
    }

    scenePlans.push({
      section: { key: `scene-${scenePlans.length}`, text: edited.overlayText, startSec: 0, endSec: 0 }, // real timing filled in below
      kind,
      buffer,
      mimeType,
      mediaAssetId,
      scriptKey: null,
      durationSec: edited.durationSec,
      overlayText: edited.overlayText,
    });
  }

  const timings = computeSectionTimingsFromDurations(
    scenePlans.map((p) => ({ key: p.section.key, text: p.overlayText ?? "", durationSec: p.durationSec ?? 0 })),
  );
  scenePlans.forEach((plan, i) => {
    plan.section = timings[i];
  });
  const totalDurationSec = timings[timings.length - 1].endSec;

  const { musicBuffer, logoBuffer, brandAccentColor } = await fetchMusicAndLogo(companyId, renderCtx.industry);
  const syntheticScript = synthesizeScriptForRender(scenePlans.map((p) => ({ text: p.overlayText ?? "" })));

  const rendered = await renderVideo({
    scenes: scenePlans.map(({ section, kind, buffer, mimeType }) => ({ section, kind, buffer, mimeType })),
    aspectRatio: video.aspectRatio,
    logoBuffer,
    narrationBuffer: null,
    narrationWords: undefined,
    musicBuffer,
    totalDurationSec,
    script: syntheticScript,
    companyLocale: renderCtx.companyLocale,
    template: video.template,
    companyName: renderCtx.companyName,
    brandAccentColor,
  });

  return persistRender(video, rendered, scenePlans);
}

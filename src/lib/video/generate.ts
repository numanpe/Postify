import "server-only";

import type { AspectRatio, VideoTemplate } from "@prisma/client";

import { db } from "@/lib/db";
import { getCompanyContext } from "@/lib/company-context";
import { storage, buildStorageKey } from "@/lib/storage";
import { getTextProviderForCompany } from "@/lib/providers/text/resolver";
import { getAiImageProviderForCompany } from "@/lib/providers/image/resolver";
import { getVoiceProviderForCompany } from "@/lib/providers/voice/resolver";
import { ProviderError } from "@/lib/providers/text/types";
import { VoiceProviderError } from "@/lib/providers/voice/types";
import type { WordTimestamp } from "@/lib/providers/voice/types";
import { ImageProviderError } from "@/lib/providers/image/types";
import { IMAGE_SHARED_POOL_NAME } from "@/lib/providers/image/shared-image-pool";
import type { FallbackInfo } from "@/lib/providers/fallback-log";
import { getMusicForIndustry } from "@/lib/video/music";
import { renderVideo, type VideoSceneInput, type SceneKind } from "@/lib/video/render";
import { captureSceneThumbnail } from "@/lib/video/scene-thumbnails";
import {
  computeSectionTimingsFromWords,
  computeSectionTimingsWithoutNarration,
  SCRIPT_SECTION_KEYS,
} from "@/lib/video/timeline";
import { POSTER_DIMENSIONS } from "@/lib/poster/dimensions";

export interface GenerateVideoCoreInput {
  companyId: string;
  userId: string;
  topic: string;
  aspectRatio: AspectRatio;
  useNarration: boolean;
  // Real Media Library assets to use as footage, in order. The caller
  // decides how these are chosen — the interactive Video Studio form
  // lets a person pick them; the campaign job processor (no UI, no
  // user present) auto-selects the company's most recent uploads
  // instead, the same "real media first" default the Poster Studio
  // already uses. This function doesn't pick defaults itself.
  assetIds?: string[];
  // Defaults to STANDARD (the plain scenes+captions+logo pipeline) —
  // the campaign job processor doesn't pass one, so a batch-generated
  // week of content isn't unexpectedly opinionated about motion style.
  template?: VideoTemplate;
}

export interface GenerateVideoCoreResult {
  videoId: string;
  warnings: string[];
  // Aggregated across every provider call this generation made (script,
  // narration, each AI B-roll still) — only populated when a real
  // runtime-failure fallback actually happened somewhere in the
  // pipeline. Real disclosure per Part 3 of the resilient-fallback-
  // chain work, never shown when every call succeeded on its
  // first-choice provider.
  fallbackFrom?: FallbackInfo[];
}

// Thrown for any user-facing failure (script/narration/image provider
// error, quality gate fail, no usable footage). Both callers — the
// direct Video Studio action and the campaign job processor — catch
// this and adapt the message into their own reporting shape, so the
// actual 7-step generation pipeline exists exactly once. Extracted
// from src/lib/actions/video.ts's generateVideo (unchanged logic,
// FormData parsing/session resolution only moved to the caller) so the
// campaign job processor can drive it without a fake form submission.
export class VideoGenerationError extends Error {}

interface SceneProvenance {
  order: number;
  kind: SceneKind;
  mediaAssetId: string | null;
  scriptKey: string;
  // Only set for non-narrated videos — mirrors the exact caption text
  // burned into that scene at render time (see render.ts: with no
  // narration words, each scene's caption is literally its section's
  // full text). Populating this at generation time is what lets the
  // scene editor's "On-screen text" field start pre-filled with the
  // video's real existing text instead of blank — an empty field there
  // otherwise trips the editor's own "every scene needs on-screen text"
  // validation on first open, before the user has touched anything.
  overlayText: string | null;
  // See scene-thumbnails.ts — captured from this scene's own clean
  // buffer right here, null for REAL_PHOTO (needs no separate copy).
  thumbnailStorageKey: string | null;
}

export async function generateVideoCore(input: GenerateVideoCoreInput): Promise<GenerateVideoCoreResult> {
  const { companyId, userId, topic, aspectRatio, useNarration } = input;
  const assetIds = input.assetIds ?? [];
  const template: VideoTemplate = input.template ?? "STANDARD";

  const context = await getCompanyContext(companyId);
  const fallbackFrom: FallbackInfo[] = [];

  // 1. Script — hook/context/value/message/CTA, same TextProvider as
  // Phase 2's captions (free template or BYOK).
  const textProvider = await getTextProviderForCompany(companyId);
  let script;
  try {
    const scriptResult = await textProvider.generateScript({ context, topic });
    script = scriptResult.script;
    if (scriptResult.fallbackFrom) fallbackFrom.push(...scriptResult.fallbackFrom);
  } catch (error) {
    if (error instanceof ProviderError) {
      throw new VideoGenerationError(`${error.providerName}: ${error.message}`);
    }
    throw error;
  }

  // 2. Narration — free by default (edge-tts); BYOK opt-in via the
  // Settings voice engine toggle. null here only means BYOK was
  // selected but no key has been saved yet.
  let narrationBuffer: Buffer | null = null;
  let narrationWords: WordTimestamp[] | undefined;
  let hasNarration = false;

  if (useNarration) {
    const voiceProvider = await getVoiceProviderForCompany(companyId);
    if (!voiceProvider) {
      throw new VideoGenerationError(
        "Add an OpenAI or ElevenLabs key in Settings, or switch back to the free voice engine.",
      );
    }
    const fullScriptText = SCRIPT_SECTION_KEYS.map((key) => script[key]).join(" ... ");
    try {
      const narrationResult = await voiceProvider.generateNarration({ text: fullScriptText });
      narrationBuffer = narrationResult.audioBuffer;
      narrationWords = narrationResult.words;
      hasNarration = true;
      if (narrationResult.fallbackFrom) fallbackFrom.push(...narrationResult.fallbackFrom);
    } catch (error) {
      if (error instanceof VoiceProviderError) {
        throw new VideoGenerationError(`${error.providerName}: ${error.message}`);
      }
      throw error;
    }
  }

  // 3. Section timing — real word timestamps when narrated, fixed
  // per-section duration otherwise.
  const sectionTimings =
    hasNarration && narrationWords
      ? computeSectionTimingsFromWords(script, narrationWords)
      : computeSectionTimingsWithoutNarration(script);
  const totalDurationSec = sectionTimings[sectionTimings.length - 1].endSec;

  // 4. Scenes — real uploaded media first (in the order given), then AI
  // stills fill any remaining slots (BYOK key, or the same free shared
  // Cloudflare pool posters use if none is configured), otherwise the
  // given assets cycle to fill out the full section count. Never offers
  // previously-generated posters/videos as source material (see Phase
  // 3's photo-picker fix).
  const selectedAssets =
    assetIds.length > 0
      ? await db.mediaAsset.findMany({
          // storageDeletedAt: null — see studio/[mode]/page.tsx's
          // identical filter; a re-rendered video's old asset passes
          // videoOutput:null too, even though its real file is gone.
          where: { id: { in: assetIds }, companyId, posterOutput: null, videoOutput: null, storageDeletedAt: null },
        })
      : [];
  const orderedAssets = assetIds
    .map((id) => selectedAssets.find((asset) => asset.id === id))
    .filter((asset): asset is (typeof selectedAssets)[number] => !!asset);

  const imageResolution = await getAiImageProviderForCompany(companyId);

  if (orderedAssets.length === 0 && !imageResolution) {
    throw new VideoGenerationError(
      "Select at least one photo or video from your Media Library, add an OpenAI/Gemini key in Settings, or try again shortly — today's free AI visual quota may be temporarily used up.",
    );
  }

  // A video can need up to 5 fresh B-roll stills (one per script
  // section) where a poster only ever needs one — real, at Nikolai's
  // request (2026-08-24 investigation), this is capped when drawing on
  // the *shared* free pool (not a company's own BYOK key/quota, which
  // isn't capped anywhere else) so one company's video generation can't
  // burn several posters' worth of the platform's shared daily quota in
  // a single request. Beyond the cap, already-generated stills are
  // cycled — visually the same "reuse real footage across scenes"
  // pattern already used for real uploaded assets above, not a
  // degraded/fake output.
  const MAX_FREE_AI_STILLS_PER_VIDEO = 2;
  const freeAiStills: { buffer: Buffer; mimeType: string; thumbnailStorageKey: string | null }[] = [];
  // Real count of calls that actually used the shared pool this video —
  // driven by each result's own providerName, not the resolver's
  // upfront `source` hint. A company's BYOK credential can now silently
  // fall through to the shared pool mid-generation (image/resolver.ts's
  // fallback chain), so `source === "BYOK"` no longer guarantees every
  // call in this loop stayed on the company's own uncapped quota —
  // only checking the real per-call result keeps this cap honest.
  let freePoolCallsUsed = 0;

  const { width, height } = POSTER_DIMENSIONS[aspectRatio];
  const scenes: VideoSceneInput[] = [];
  const sceneProvenance: SceneProvenance[] = [];

  for (let i = 0; i < sectionTimings.length; i += 1) {
    const section = sectionTimings[i];

    if (i < orderedAssets.length) {
      const asset = orderedAssets[i];
      const buffer = await storage.get(asset.storageKey);
      const kind: SceneKind = asset.mimeType.startsWith("video/") ? "REAL_VIDEO" : "REAL_PHOTO";
      scenes.push({ section, kind, buffer, mimeType: asset.mimeType });
      sceneProvenance.push({
        order: i,
        kind,
        mediaAssetId: asset.id,
        scriptKey: section.key,
        overlayText: hasNarration ? null : section.text,
        thumbnailStorageKey: await captureSceneThumbnail(companyId, kind, buffer, asset.mimeType),
      });
      continue;
    }

    const atFreePoolCap = freePoolCallsUsed >= MAX_FREE_AI_STILLS_PER_VIDEO;

    if (imageResolution && !atFreePoolCap) {
      try {
        const result = await imageResolution.provider.generateBackground({
          companyName: context.name,
          industry: context.industry,
          tone: context.tone,
          topic: section.text,
          widthPx: width,
          heightPx: height,
        });
        const thumbnailStorageKey = await captureSceneThumbnail(companyId, "AI_STILL", result.buffer, result.mimeType);
        if (result.providerName === IMAGE_SHARED_POOL_NAME) {
          freePoolCallsUsed += 1;
          freeAiStills.push({ buffer: result.buffer, mimeType: result.mimeType, thumbnailStorageKey });
        }
        if (result.fallbackFrom) fallbackFrom.push(...result.fallbackFrom);
        scenes.push({ section, kind: "AI_STILL", buffer: result.buffer, mimeType: result.mimeType });
        sceneProvenance.push({
          order: i,
          kind: "AI_STILL",
          mediaAssetId: null,
          scriptKey: section.key,
          overlayText: hasNarration ? null : section.text,
          thumbnailStorageKey,
        });
      } catch (error) {
        if (error instanceof ImageProviderError) {
          throw new VideoGenerationError(`${error.providerName}: ${error.message}`);
        }
        throw error;
      }
      continue;
    }

    if (freeAiStills.length > 0) {
      const reused = freeAiStills[i % freeAiStills.length];
      scenes.push({ section, kind: "AI_STILL", buffer: reused.buffer, mimeType: reused.mimeType });
      sceneProvenance.push({
        order: i,
        kind: "AI_STILL",
        mediaAssetId: null,
        scriptKey: section.key,
        overlayText: hasNarration ? null : section.text,
        // Reuses the already-captured thumbnail for this exact buffer —
        // no point re-extracting from a still we've already thumbnailed.
        thumbnailStorageKey: reused.thumbnailStorageKey,
      });
      continue;
    }

    const asset = orderedAssets[i % orderedAssets.length];
    const buffer = await storage.get(asset.storageKey);
    const kind: SceneKind = asset.mimeType.startsWith("video/") ? "REAL_VIDEO" : "REAL_PHOTO";
    scenes.push({ section, kind, buffer, mimeType: asset.mimeType });
    sceneProvenance.push({
      order: i,
      kind,
      mediaAssetId: asset.id,
      scriptKey: section.key,
      overlayText: hasNarration ? null : section.text,
      thumbnailStorageKey: await captureSceneThumbnail(companyId, kind, buffer, asset.mimeType),
    });
  }

  // 5. Music — bundled library, auto-selected by industry tone.
  const musicBuffer = await getMusicForIndustry(context.industry);

  // 6. Branding
  const brandKit = await db.brandKit.findUnique({
    where: { companyId },
    include: { logoAsset: true },
  });
  const logoBuffer = brandKit?.logoAsset ? await storage.get(brandKit.logoAsset.storageKey) : null;

  // 7. Render + quality gate
  const rendered = await renderVideo({
    scenes,
    aspectRatio,
    logoBuffer,
    narrationBuffer,
    narrationWords,
    musicBuffer,
    totalDurationSec,
    script,
    companyLocale: context.locale,
    template,
    companyName: context.name,
    brandAccentColor: brandKit?.accentColor,
  });

  if (!rendered.qualityGate.passed) {
    const failMessages = rendered.qualityGate.issues
      .filter((issue) => issue.severity === "fail")
      .map((issue) => issue.message);
    throw new VideoGenerationError(`Quality check failed: ${failMessages.join(" ")}`);
  }
  const warnings = rendered.qualityGate.issues
    .filter((issue) => issue.severity === "warning")
    .map((issue) => issue.message);

  // 8. Save — same MediaAsset/storage machinery as posters/uploads.
  const storageKey = buildStorageKey(companyId, `video-${aspectRatio.toLowerCase()}.mp4`);
  await storage.put(storageKey, rendered.mp4);

  const orientation =
    rendered.width === rendered.height
      ? "square"
      : rendered.width > rendered.height
        ? "landscape"
        : "portrait";

  const asset = await db.mediaAsset.create({
    data: {
      companyId,
      uploadedById: userId,
      storageKey,
      fileName: `video-${Date.now()}.mp4`,
      mimeType: "video/mp4",
      sizeBytes: rendered.mp4.byteLength,
      width: rendered.width,
      height: rendered.height,
      orientation,
    },
  });

  const video = await db.video.create({
    data: {
      companyId,
      assetId: asset.id,
      topic,
      script: { ...script },
      aspectRatio,
      template,
      hasNarration,
      scenes: {
        create: sceneProvenance.map((scene) => ({
          order: scene.order,
          kind: scene.kind,
          mediaAssetId: scene.mediaAssetId,
          scriptKey: scene.scriptKey,
          overlayText: scene.overlayText,
          thumbnailStorageKey: scene.thumbnailStorageKey,
        })),
      },
    },
  });

  return { videoId: video.id, warnings, fallbackFrom: fallbackFrom.length > 0 ? fallbackFrom : undefined };
}

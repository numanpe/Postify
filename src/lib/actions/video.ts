"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requireCompany } from "@/lib/session";
import { getCompanyContext } from "@/lib/company-context";
import { storage, buildStorageKey } from "@/lib/storage";
import { getTextProviderForCompany } from "@/lib/providers/text/resolver";
import { getAiImageProviderForCompany } from "@/lib/providers/image/resolver";
import { getVoiceProviderForCompany } from "@/lib/providers/voice/resolver";
import { ProviderError } from "@/lib/providers/text/types";
import { VoiceProviderError } from "@/lib/providers/voice/types";
import type { WordTimestamp } from "@/lib/providers/voice/types";
import { ImageProviderError } from "@/lib/providers/image/types";
import { getMusicForIndustry } from "@/lib/video/music";
import { renderVideo, type VideoSceneInput, type SceneKind } from "@/lib/video/render";
import {
  computeSectionTimingsFromWords,
  computeSectionTimingsWithoutNarration,
  SCRIPT_SECTION_KEYS,
} from "@/lib/video/timeline";
import { POSTER_DIMENSIONS } from "@/lib/poster/dimensions";

export type GenerateVideoState =
  | { status: "error"; error: string }
  | { status: "success"; videoId: string; warnings: string[] }
  | undefined;

const VideoSchema = z.object({
  topic: z.string().trim().min(3, "Describe what this video is about.").max(300),
  aspectRatio: z.enum(["SQUARE", "STORY", "LANDSCAPE"]),
  useNarration: z.preprocess((value) => value === "on" || value === "true", z.boolean()),
  assetIds: z.array(z.string()).default([]),
});

interface SceneProvenance {
  order: number;
  kind: SceneKind;
  mediaAssetId: string | null;
}

export async function generateVideo(
  _prevState: GenerateVideoState,
  formData: FormData,
): Promise<GenerateVideoState> {
  const { user, company } = await requireCompany();

  const parsed = VideoSchema.safeParse({
    topic: formData.get("topic"),
    aspectRatio: formData.get("aspectRatio"),
    useNarration: formData.get("useNarration"),
    assetIds: formData.getAll("assetIds"),
  });
  if (!parsed.success) {
    return { status: "error", error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { topic, aspectRatio, useNarration, assetIds } = parsed.data;

  const context = await getCompanyContext(company.id);

  // 1. Script — hook/context/value/message/CTA, same TextProvider as
  // Phase 2's captions (free template or BYOK).
  const textProvider = await getTextProviderForCompany(company.id);
  let script;
  try {
    const scriptResult = await textProvider.generateScript({ context, topic });
    script = scriptResult.script;
  } catch (error) {
    if (error instanceof ProviderError) {
      return { status: "error", error: `${error.providerName}: ${error.message}` };
    }
    throw error;
  }

  // 2. Narration — BYOK only. See README.md for why the free tier
  // ships without spoken narration.
  let narrationBuffer: Buffer | null = null;
  let narrationWords: WordTimestamp[] | undefined;
  let hasNarration = false;

  if (useNarration) {
    const voiceProvider = await getVoiceProviderForCompany(company.id);
    if (!voiceProvider) {
      return { status: "error", error: "Add an OpenAI key in Settings to generate narration." };
    }
    const fullScriptText = SCRIPT_SECTION_KEYS.map((key) => script[key]).join(" ... ");
    try {
      const narrationResult = await voiceProvider.generateNarration({ text: fullScriptText });
      narrationBuffer = narrationResult.audioBuffer;
      narrationWords = narrationResult.words;
      hasNarration = true;
    } catch (error) {
      if (error instanceof VoiceProviderError) {
        return { status: "error", error: `${error.providerName}: ${error.message}` };
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

  // 4. Scenes — real uploaded media first (in the order selected),
  // AI stills fill any remaining slots when an OpenAI key is
  // configured, otherwise the selected assets cycle to fill out the
  // full section count. Never offers previously-generated posters/
  // videos as source material (see Phase 3's photo-picker fix).
  const selectedAssets =
    assetIds.length > 0
      ? await db.mediaAsset.findMany({
          where: { id: { in: assetIds }, companyId: company.id, posterOutput: null, videoOutput: null },
        })
      : [];
  const orderedAssets = assetIds
    .map((id) => selectedAssets.find((asset) => asset.id === id))
    .filter((asset): asset is (typeof selectedAssets)[number] => !!asset);

  const imageProvider = await getAiImageProviderForCompany(company.id);

  if (orderedAssets.length === 0 && !imageProvider) {
    return {
      status: "error",
      error:
        "Select at least one photo or video from your Media Library, or add an OpenAI key in Settings to generate visuals.",
    };
  }

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
      sceneProvenance.push({ order: i, kind, mediaAssetId: asset.id });
      continue;
    }

    if (imageProvider) {
      try {
        const result = await imageProvider.generateBackground({
          companyName: context.name,
          industry: context.industry,
          tone: context.tone,
          topic: section.text,
          widthPx: width,
          heightPx: height,
        });
        scenes.push({ section, kind: "AI_STILL", buffer: result.buffer, mimeType: result.mimeType });
        sceneProvenance.push({ order: i, kind: "AI_STILL", mediaAssetId: null });
      } catch (error) {
        if (error instanceof ImageProviderError) {
          return { status: "error", error: `${error.providerName}: ${error.message}` };
        }
        throw error;
      }
      continue;
    }

    const asset = orderedAssets[i % orderedAssets.length];
    const buffer = await storage.get(asset.storageKey);
    const kind: SceneKind = asset.mimeType.startsWith("video/") ? "REAL_VIDEO" : "REAL_PHOTO";
    scenes.push({ section, kind, buffer, mimeType: asset.mimeType });
    sceneProvenance.push({ order: i, kind, mediaAssetId: asset.id });
  }

  // 5. Music — bundled library, auto-selected by industry tone.
  const musicBuffer = await getMusicForIndustry(context.industry);

  // 6. Branding
  const brandKit = await db.brandKit.findUnique({
    where: { companyId: company.id },
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
  });

  if (!rendered.qualityGate.passed) {
    const failMessages = rendered.qualityGate.issues
      .filter((issue) => issue.severity === "fail")
      .map((issue) => issue.message);
    return { status: "error", error: `Quality check failed: ${failMessages.join(" ")}` };
  }
  const warnings = rendered.qualityGate.issues
    .filter((issue) => issue.severity === "warning")
    .map((issue) => issue.message);

  // 8. Save — same MediaAsset/storage machinery as posters/uploads.
  const storageKey = buildStorageKey(company.id, `video-${aspectRatio.toLowerCase()}.mp4`);
  await storage.put(storageKey, rendered.mp4);

  const orientation =
    rendered.width === rendered.height
      ? "square"
      : rendered.width > rendered.height
        ? "landscape"
        : "portrait";

  const asset = await db.mediaAsset.create({
    data: {
      companyId: company.id,
      uploadedById: user.id,
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
      companyId: company.id,
      assetId: asset.id,
      topic,
      script: { ...script },
      aspectRatio,
      hasNarration,
      scenes: {
        create: sceneProvenance.map((scene) => ({
          order: scene.order,
          kind: scene.kind,
          mediaAssetId: scene.mediaAssetId,
        })),
      },
    },
  });

  revalidatePath("/video");
  return { status: "success", videoId: video.id, warnings };
}

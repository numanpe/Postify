import "server-only";
import path from "node:path";
import { readFile } from "node:fs/promises";
import sharp from "sharp";

import type { AspectRatio, VideoTemplate } from "@prisma/client";

import { POSTER_DIMENSIONS } from "@/lib/poster/dimensions";
import { runFfmpeg, probeMedia } from "./ffmpeg";
import { withScratchDir, writeScratchFile } from "./scratch";
import { renderCaptionChunks, chunkWordsIntoCaptions, type CaptionChunk } from "./captions";
import { renderLowerThirdBannerPng } from "./lower-third";
import { buildWaveformBandFilter } from "./waveform";
import { runVideoQualityGate, type QualityGateResult } from "./quality-gate";
import type { SectionTiming } from "./timeline";
import type { WordTimestamp } from "@/lib/providers/voice/types";
import type { VideoScriptSections } from "@/lib/providers/text/types";

export type SceneKind = "REAL_PHOTO" | "REAL_VIDEO" | "AI_STILL";

export interface VideoSceneInput {
  section: SectionTiming;
  kind: SceneKind;
  buffer: Buffer;
  mimeType: string;
}

export interface RenderVideoInput {
  scenes: VideoSceneInput[]; // one per script section, in order
  aspectRatio: AspectRatio;
  logoBuffer?: Buffer | null;
  narrationBuffer?: Buffer | null; // present only when BYOK narration was generated
  narrationWords?: WordTimestamp[]; // for word-level captions; absent -> one caption per section
  musicBuffer: Buffer;
  totalDurationSec: number;
  script: VideoScriptSections;
  companyLocale: "EN" | "AR";
  template: VideoTemplate;
  companyName: string; // shown in the LOWER_THIRD_PROMO banner
  brandAccentColor?: string | null; // banner accent stripe; falls back to a neutral red if absent/invalid
}

export interface RenderVideoOutput {
  mp4: Buffer;
  width: number;
  height: number;
  durationSec: number;
  qualityGate: QualityGateResult;
}

const FPS = 30;
// Subtle Ken Burns drift on stills — restrained on purpose. The pipeline
// leans on real video clips when available, narration, music, and
// burned-in captions to stay well clear of "static slideshow with zoom
// effects," which CLAUDE.md calls an explicit fail condition; this
// motion is one texture among several, not the whole technique.
const ZOOM_PER_SECOND = 0.018;

function extensionForMimeType(mimeType: string): string {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  if (mimeType.startsWith("video/")) return "mp4";
  return "bin";
}

async function createSceneSegment(
  scene: VideoSceneInput,
  width: number,
  height: number,
  dir: string,
  index: number,
): Promise<string> {
  const duration = Math.max(scene.section.endSec - scene.section.startSec, 0.5);
  const srcPath = await writeScratchFile(
    dir,
    `scene-${index}-src.${extensionForMimeType(scene.mimeType)}`,
    scene.buffer,
  );
  const outPath = path.join(dir, `scene-${index}.mp4`);

  if (scene.kind === "REAL_VIDEO") {
    await runFfmpeg([
      "-stream_loop",
      "-1",
      "-i",
      srcPath,
      "-t",
      duration.toFixed(3),
      "-vf",
      `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},fps=${FPS}`,
      "-an",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      outPath,
    ]);
  } else {
    const frames = Math.round(duration * FPS);
    const zoomTarget = 1 + ZOOM_PER_SECOND * duration;
    await runFfmpeg([
      "-loop",
      "1",
      "-i",
      srcPath,
      "-t",
      duration.toFixed(3),
      "-vf",
      [
        `scale=${Math.round(width * 1.2)}:${Math.round(height * 1.2)}:force_original_aspect_ratio=increase`,
        `crop=${Math.round(width * 1.2)}:${Math.round(height * 1.2)}`,
        `zoompan=z='min(zoom+${(ZOOM_PER_SECOND / FPS).toFixed(6)},${zoomTarget.toFixed(4)})':d=${frames}:s=${width}x${height}:fps=${FPS}`,
      ].join(","),
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      outPath,
    ]);
  }

  return outPath;
}

async function concatScenes(scenePaths: string[], dir: string): Promise<string> {
  const listPath = path.join(dir, "concat-list.txt");
  const listContent = scenePaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n");
  await writeScratchFile(dir, "concat-list.txt", Buffer.from(listContent, "utf8"));

  const outPath = path.join(dir, "concat.mp4");
  await runFfmpeg(["-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", outPath]);
  return outPath;
}

// Audio-only mix (narration ducked under music, or music alone) — kept
// separate from video compositing so the exact same mixed track can
// feed both the final mux AND, for WAVEFORM_CAPTIONS, the showwaves
// visualization. Previously this logic lived inline in a combined
// video+audio mux step; factored out so it's computed once, not
// duplicated between the two call sites.
async function mixAudioTrack(
  narrationBuffer: Buffer | null | undefined,
  musicBuffer: Buffer,
  totalDurationSec: number,
  dir: string,
): Promise<string> {
  const musicPath = await writeScratchFile(dir, "music.mp3", musicBuffer);
  const outPath = path.join(dir, "mixed-audio.m4a");

  if (narrationBuffer) {
    const narrationPath = await writeScratchFile(dir, "narration.mp3", narrationBuffer);
    // Real auto-ducking: sidechaincompress lowers the music bus
    // whenever the narration bus is loud, not a static volume cut for
    // the whole clip.
    await runFfmpeg([
      "-i",
      narrationPath,
      "-stream_loop",
      "-1",
      "-i",
      musicPath,
      "-filter_complex",
      [
        "[1:a]volume=0.9[music]",
        "[0:a]asplit=2[narr1][narr2]",
        "[music][narr1]sidechaincompress=threshold=0.05:ratio=8:attack=50:release=400[ducked]",
        "[ducked][narr2]amix=inputs=2:duration=first:weights=1 1.4[aout]",
      ].join(";"),
      "-map",
      "[aout]",
      "-t",
      totalDurationSec.toFixed(3),
      "-c:a",
      "aac",
      outPath,
    ]);
  } else {
    await runFfmpeg([
      "-stream_loop",
      "-1",
      "-i",
      musicPath,
      "-filter_complex",
      "[0:a]volume=0.5[aout]",
      "-map",
      "[aout]",
      "-t",
      totalDurationSec.toFixed(3),
      "-c:a",
      "aac",
      outPath,
    ]);
  }

  return outPath;
}

async function combineVideoAndAudio(
  videoPath: string,
  mixedAudioPath: string,
  totalDurationSec: number,
  dir: string,
): Promise<string> {
  const outPath = path.join(dir, "final.mp4");
  await runFfmpeg([
    "-i",
    videoPath,
    "-i",
    mixedAudioPath,
    "-map",
    "0:v",
    "-map",
    "1:a",
    "-t",
    totalDurationSec.toFixed(3),
    "-c:v",
    "copy",
    "-c:a",
    "copy",
    "-movflags",
    "+faststart",
    outPath,
  ]);
  return outPath;
}

interface LowerThirdOverlaySpec {
  png: Buffer;
  bannerWidth: number;
  bannerHeight: number;
  y: number;
  direction: "ltr" | "rtl";
  windowStartSec: number;
  windowEndSec: number;
}

interface WaveformOverlaySpec {
  mixedAudioPath: string;
  bandWidth: number;
  bandHeight: number;
  y: number;
}

// Builds the ffmpeg eval expression for a slide-in/hold/slide-out x
// position — the "keyframed overlay" motion: position is a function
// of t (real ffmpeg eval syntax, nested if(cond,then,else)), not a
// single static value. LTR banners enter from off-screen left and
// rest flush left; RTL banners mirror to enter from the right and
// rest flush right, matching the banner's own text alignment.
function buildSlideXExpr(spec: LowerThirdOverlaySpec, canvasWidth: number): string {
  const { direction, bannerWidth, windowStartSec, windowEndSec } = spec;
  const slideDur = Math.min(0.6, Math.max((windowEndSec - windowStartSec) / 3, 0.15));
  const restX = direction === "ltr" ? 0 : canvasWidth - bannerWidth;
  const offX = direction === "ltr" ? -bannerWidth : canvasWidth;
  const inEnd = windowStartSec + slideDur;
  const outStart = Math.max(windowEndSec - slideDur, inEnd);

  const f = (n: number) => n.toFixed(2);
  return (
    `if(lt(t,${f(windowStartSec)}),${f(offX)},` +
    `if(lt(t,${f(inEnd)}),${f(offX)}+(t-${f(windowStartSec)})/${f(slideDur)}*(${f(restX)}-(${f(offX)})),` +
    `if(lt(t,${f(outStart)}),${f(restX)},` +
    `if(lt(t,${f(windowEndSec)}),${f(restX)}+(t-${f(outStart)})/${f(slideDur)}*(${f(offX)}-(${f(restX)})),` +
    `${f(offX)}))))`
  );
}

async function compositeOverlays(
  concatPath: string,
  logoBuffer: Buffer | null | undefined,
  captions: { png: Buffer; startSec: number; endSec: number }[],
  lowerThirds: LowerThirdOverlaySpec[],
  waveform: WaveformOverlaySpec | null,
  width: number,
  height: number,
  totalDurationSec: number,
  dir: string,
): Promise<string> {
  const inputs: string[] = ["-i", concatPath];
  const filters: string[] = [];
  let lastLabel = "0:v";
  let inputIndex = 1;

  if (logoBuffer) {
    const logoPath = await writeScratchFile(dir, "logo.png", logoBuffer);
    inputs.push("-loop", "1", "-i", logoPath);
    const logoHeight = Math.round(height * 0.09);
    const logoMargin = Math.round(Math.min(width, height) * 0.04);
    filters.push(
      `[${inputIndex}:v]scale=-1:${logoHeight}[logo]`,
      `[${lastLabel}][logo]overlay=${logoMargin}:${logoMargin}[ov${inputIndex}]`,
    );
    lastLabel = `ov${inputIndex}`;
    inputIndex += 1;
  }

  for (const banner of lowerThirds) {
    const bannerPath = await writeScratchFile(dir, `lower-third-${inputIndex}.png`, banner.png);
    inputs.push("-loop", "1", "-i", bannerPath);
    // No enable= gating needed — the x-expression itself keeps the
    // banner off-canvas outside its active window.
    const xExpr = buildSlideXExpr(banner, width);
    filters.push(`[${lastLabel}][${inputIndex}:v]overlay=x='${xExpr}':y=${banner.y}[ov${inputIndex}]`);
    lastLabel = `ov${inputIndex}`;
    inputIndex += 1;
  }

  if (waveform) {
    inputs.push("-i", waveform.mixedAudioPath);
    const waveLabel = `wave${inputIndex}`;
    filters.push(
      buildWaveformBandFilter({
        audioInputLabel: `${inputIndex}:a`,
        width: waveform.bandWidth,
        height: waveform.bandHeight,
        durationSec: totalDurationSec,
        fps: FPS,
        outputLabel: waveLabel,
      }),
    );
    filters.push(`[${lastLabel}][${waveLabel}]overlay=x=0:y=${waveform.y}[ov${inputIndex}]`);
    lastLabel = `ov${inputIndex}`;
    inputIndex += 1;
  }

  for (const caption of captions) {
    // Real, measured fix (2026-08-29): renderCaptionPng renders every
    // caption at the FULL video canvas size even though the real
    // visible content (the dark badge + text) only occupies a small
    // region near the bottom — every overlay stage was alpha-blending
    // the entire frame regardless. Cropping to the real bounding box
    // before compositing measured an 8.7x real speedup in isolation
    // (189.8s -> 21.8s for 14 sequential overlays) and reproduced the
    // exact original visual position via sharp's own real trim offsets
    // — verified before this was written, not assumed. Falls back to
    // the untrimmed full-canvas PNG at 0:0 for the one real edge case
    // (a fully transparent caption image) rather than failing the
    // whole render over it — never expected in practice, since every
    // real caption chunk has real text, but cheap to guard.
    let croppedPng = caption.png;
    let x = 0;
    let y = 0;
    try {
      const { data, info } = await sharp(caption.png).trim().toBuffer({ resolveWithObject: true });
      if (info.width > 0 && info.height > 0) {
        croppedPng = data;
        x = -(info.trimOffsetLeft ?? 0);
        y = -(info.trimOffsetTop ?? 0);
      }
    } catch {
      // Degenerate input (e.g. fully transparent) — fall back to the
      // untrimmed PNG at 0:0, already assigned above.
    }

    const captionPath = await writeScratchFile(dir, `caption-${inputIndex}.png`, croppedPng);
    inputs.push("-loop", "1", "-i", captionPath);
    filters.push(
      `[${lastLabel}][${inputIndex}:v]overlay=${x}:${y}:enable='between(t,${caption.startSec.toFixed(3)},${caption.endSec.toFixed(3)})'[ov${inputIndex}]`,
    );
    lastLabel = `ov${inputIndex}`;
    inputIndex += 1;
  }

  const outPath = path.join(dir, "branded.mp4");
  await runFfmpeg([
    ...inputs,
    "-filter_complex",
    filters.join(";"),
    "-map",
    `[${lastLabel}]`,
    // Looped image inputs (logo, banners, captions) have no inherent
    // duration, so without an explicit bound here the encode runs
    // indefinitely instead of stopping when the base video ends.
    "-t",
    totalDurationSec.toFixed(3),
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    outPath,
  ]);

  return outPath;
}

export async function renderVideo(input: RenderVideoInput): Promise<RenderVideoOutput> {
  const { width, height } = POSTER_DIMENSIONS[input.aspectRatio];

  return withScratchDir(async (dir) => {
    const scenePaths = await Promise.all(
      input.scenes.map((scene, index) => createSceneSegment(scene, width, height, dir, index)),
    );
    const concatPath = await concatScenes(scenePaths, dir);

    const captionChunks: CaptionChunk[] =
      input.narrationWords && input.narrationWords.length > 0
        ? chunkWordsIntoCaptions(input.narrationWords)
        : input.scenes.map((scene) => ({
            text: scene.section.text,
            startSec: scene.section.startSec,
            endSec: scene.section.endSec,
          }));
    const renderedCaptions = await renderCaptionChunks(captionChunks, width, height);

    // Mixed first (not last, as the old single muxAudio step did) —
    // WAVEFORM_CAPTIONS needs the real final audio to visualize, and
    // both templates need it available before compositing either way.
    const mixedAudioPath = await mixAudioTrack(
      input.narrationBuffer,
      input.musicBuffer,
      input.totalDurationSec,
      dir,
    );

    // Same band position for both motion templates — directly above
    // the caption zone — so only one ever renders per video (the
    // template choice is mutually exclusive) but they share a
    // consistent visual "zone" language.
    const overlayBandBottomMargin = Math.round(height * 0.23);

    const lowerThirds: LowerThirdOverlaySpec[] = [];
    if (input.template === "LOWER_THIRD_PROMO") {
      const hookScene = input.scenes.find((s) => s.section.key === "hook");
      const ctaScene = input.scenes.find((s) => s.section.key === "cta");
      if (hookScene) {
        const rendered = await renderLowerThirdBannerPng(
          input.script.hook,
          input.companyName,
          width,
          height,
          input.brandAccentColor,
        );
        lowerThirds.push({
          png: rendered.png,
          bannerWidth: rendered.width,
          bannerHeight: rendered.height,
          y: height - overlayBandBottomMargin - rendered.height,
          direction: rendered.direction,
          windowStartSec: hookScene.section.startSec,
          windowEndSec: hookScene.section.endSec,
        });
      }
      if (ctaScene) {
        const rendered = await renderLowerThirdBannerPng(
          input.script.cta,
          input.companyName,
          width,
          height,
          input.brandAccentColor,
        );
        lowerThirds.push({
          png: rendered.png,
          bannerWidth: rendered.width,
          bannerHeight: rendered.height,
          y: height - overlayBandBottomMargin - rendered.height,
          direction: rendered.direction,
          windowStartSec: ctaScene.section.startSec,
          windowEndSec: ctaScene.section.endSec,
        });
      }
    }

    let waveform: WaveformOverlaySpec | null = null;
    if (input.template === "WAVEFORM_CAPTIONS") {
      const bandHeight = Math.round(height * 0.09);
      waveform = {
        mixedAudioPath,
        bandWidth: width,
        bandHeight,
        y: height - overlayBandBottomMargin - bandHeight,
      };
    }

    const brandedPath = await compositeOverlays(
      concatPath,
      input.logoBuffer,
      renderedCaptions,
      lowerThirds,
      waveform,
      width,
      height,
      input.totalDurationSec,
      dir,
    );

    const finalPath = await combineVideoAndAudio(brandedPath, mixedAudioPath, input.totalDurationSec, dir);

    const qualityGate = await runVideoQualityGate({
      videoPath: finalPath,
      expectedDurationSec: input.totalDurationSec,
      script: input.script,
      companyLocale: input.companyLocale,
    });

    const probe = await probeMedia(finalPath);
    const mp4 = await readFile(finalPath);

    return { mp4, width, height, durationSec: probe.durationSec, qualityGate };
  });
}

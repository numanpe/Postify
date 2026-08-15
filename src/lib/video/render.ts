import "server-only";
import path from "node:path";
import { readFile } from "node:fs/promises";

import type { AspectRatio } from "@prisma/client";

import { POSTER_DIMENSIONS } from "@/lib/poster/dimensions";
import { runFfmpeg, probeMedia } from "./ffmpeg";
import { withScratchDir, writeScratchFile } from "./scratch";
import { renderCaptionChunks, chunkWordsIntoCaptions, type CaptionChunk } from "./captions";
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

async function overlayBrandingAndCaptions(
  concatPath: string,
  logoBuffer: Buffer | null | undefined,
  captions: { png: Buffer; startSec: number; endSec: number }[],
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

  for (const caption of captions) {
    const captionPath = await writeScratchFile(dir, `caption-${inputIndex}.png`, caption.png);
    inputs.push("-loop", "1", "-i", captionPath);
    filters.push(
      `[${lastLabel}][${inputIndex}:v]overlay=0:0:enable='between(t,${caption.startSec.toFixed(3)},${caption.endSec.toFixed(3)})'[ov${inputIndex}]`,
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
    // Looped image inputs (logo, captions) have no inherent duration,
    // so without an explicit bound here the encode runs indefinitely
    // instead of stopping when the base video ends.
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

async function muxAudio(
  videoPath: string,
  narrationBuffer: Buffer | null | undefined,
  musicBuffer: Buffer,
  totalDurationSec: number,
  dir: string,
): Promise<string> {
  const musicPath = await writeScratchFile(dir, "music.mp3", musicBuffer);
  const outPath = path.join(dir, "final.mp4");

  if (narrationBuffer) {
    const narrationPath = await writeScratchFile(dir, "narration.mp3", narrationBuffer);
    // Real auto-ducking: sidechaincompress lowers the music bus
    // whenever the narration bus is loud, not a static volume cut for
    // the whole clip.
    await runFfmpeg([
      "-i",
      videoPath,
      "-i",
      narrationPath,
      "-stream_loop",
      "-1",
      "-i",
      musicPath,
      "-filter_complex",
      [
        "[2:a]volume=0.9[music]",
        "[1:a]asplit=2[narr1][narr2]",
        "[music][narr1]sidechaincompress=threshold=0.05:ratio=8:attack=50:release=400[ducked]",
        "[ducked][narr2]amix=inputs=2:duration=first:weights=1 1.4[aout]",
      ].join(";"),
      "-map",
      "0:v",
      "-map",
      "[aout]",
      "-t",
      totalDurationSec.toFixed(3),
      "-c:v",
      "copy",
      "-c:a",
      "aac",
      outPath,
    ]);
  } else {
    await runFfmpeg([
      "-i",
      videoPath,
      "-stream_loop",
      "-1",
      "-i",
      musicPath,
      "-filter_complex",
      "[1:a]volume=0.5[aout]",
      "-map",
      "0:v",
      "-map",
      "[aout]",
      "-t",
      totalDurationSec.toFixed(3),
      "-c:v",
      "copy",
      "-c:a",
      "aac",
      outPath,
    ]);
  }

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

    const brandedPath = await overlayBrandingAndCaptions(
      concatPath,
      input.logoBuffer,
      renderedCaptions,
      width,
      height,
      input.totalDurationSec,
      dir,
    );

    const finalPath = await muxAudio(
      brandedPath,
      input.narrationBuffer,
      input.musicBuffer,
      input.totalDurationSec,
      dir,
    );

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

import "server-only";
import path from "node:path";
import { readFile } from "node:fs/promises";

import { runFfmpeg, probeMedia } from "./ffmpeg";
import { withScratchDir, writeScratchFile } from "./scratch";
import { renderCaptionPng } from "./captions";

export interface EditVideoInput {
  sourceBuffer: Buffer;
  width: number;
  height: number;
  trimStartSec?: number;
  trimEndSec?: number;
  // Reuses renderCaptionPng's exact RTL-correct, bundled-font rendering
  // (same dark pill in the lower third) — not a second text-rendering
  // path. Burned in across the whole (possibly trimmed) duration.
  overlayText?: string;
}

export interface EditVideoOutput {
  mp4: Buffer;
  durationSec: number;
}

// Both operations this supports — trim and a burned-in text overlay —
// are extensions of the existing FFmpeg pipeline (render.ts), reusing
// its exact compositing technique (overlay filter over a looped PNG) and
// text renderer, not a new engine or external service. See the doc
// comment on editCampaignItemVideo in actions/video-edit.ts for the
// storage-cleanup safety rule this feeds into.
export async function editVideo(input: EditVideoInput): Promise<EditVideoOutput> {
  return withScratchDir(async (dir) => {
    const srcPath = await writeScratchFile(dir, "source.mp4", input.sourceBuffer);
    const probe = await probeMedia(srcPath);

    let currentPath = srcPath;

    if (input.trimStartSec !== undefined || input.trimEndSec !== undefined) {
      const start = Math.max(input.trimStartSec ?? 0, 0);
      const end = Math.min(input.trimEndSec ?? probe.durationSec, probe.durationSec);
      if (end - start < 0.5) {
        throw new Error("Trim range must be at least half a second long.");
      }
      const trimmedPath = path.join(dir, "trimmed.mp4");
      await runFfmpeg([
        "-i",
        currentPath,
        "-ss",
        start.toFixed(3),
        "-to",
        end.toFixed(3),
        "-c:v",
        "libx264",
        "-c:a",
        "aac",
        "-pix_fmt",
        "yuv420p",
        trimmedPath,
      ]);
      currentPath = trimmedPath;
    }

    if (input.overlayText) {
      const overlayPng = await renderCaptionPng(input.overlayText, input.width, input.height);
      const overlayPath = await writeScratchFile(dir, "overlay.png", overlayPng);
      const overlaidPath = path.join(dir, "overlaid.mp4");
      await runFfmpeg([
        "-i",
        currentPath,
        "-loop",
        "1",
        "-i",
        overlayPath,
        "-filter_complex",
        "[0:v][1:v]overlay=0:0:shortest=1[ov]",
        "-map",
        "[ov]",
        "-map",
        "0:a?",
        "-c:v",
        "libx264",
        "-c:a",
        "aac",
        "-pix_fmt",
        "yuv420p",
        overlaidPath,
      ]);
      currentPath = overlaidPath;
    }

    const finalProbe = await probeMedia(currentPath);
    // currentPath is always a name we generated under a fresh mkdtemp()
    // scratch dir, never user input — but Turbopack's static analysis
    // can't prove that, and without this hint it traces (and bundles)
    // the entire project as a defensive fallback. Same fix Next's own
    // build output suggests.
    const mp4 = await readFile(/*turbopackIgnore: true*/ currentPath);
    return { mp4, durationSec: finalProbe.durationSec };
  });
}

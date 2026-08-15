import "server-only";

import { runFfmpeg, probeMedia } from "./ffmpeg";
import { isArabicScript } from "@/lib/poster/direction";
import type { VideoScriptSections } from "@/lib/providers/text/types";

export interface QualityGateIssue {
  code: string;
  severity: "fail" | "warning";
  message: string;
}

export interface QualityGateResult {
  passed: boolean;
  issues: QualityGateIssue[];
}

export interface VideoQualityGateInput {
  videoPath: string;
  expectedDurationSec: number;
  script: VideoScriptSections;
  companyLocale: "EN" | "AR";
}

const DURATION_TOLERANCE_SEC = 0.75;
const MAX_VOLUME_CLIP_THRESHOLD_DB = -0.5; // effectively 0 dBFS = clipping

async function detectBlackFrames(videoPath: string): Promise<boolean> {
  // blackdetect analyzes and logs findings to stderr; -f null - means
  // "analyze only, write nothing." A run with no black_start lines in
  // stderr means no black segments were found.
  const { stderr } = await runFfmpeg([
    "-i",
    videoPath,
    "-vf",
    "blackdetect=d=0.15:pix_th=0.10",
    "-an",
    "-f",
    "null",
    "-",
  ]);
  return /black_start/.test(stderr);
}

async function detectAudioClipping(videoPath: string): Promise<number | null> {
  const { stderr } = await runFfmpeg(["-i", videoPath, "-af", "volumedetect", "-vn", "-f", "null", "-"]);
  const match = stderr.match(/max_volume:\s*(-?\d+(?:\.\d+)?)\s*dB/);
  return match ? Number(match[1]) : null;
}

// Real, automated checks against the actual rendered file — not
// structural assumptions. See poster/quality-gate.ts for the same
// philosophy applied to posters; a spelling gate is equally not
// implemented here for the same "needs a real dictionary" reason.
export async function runVideoQualityGate(input: VideoQualityGateInput): Promise<QualityGateResult> {
  const issues: QualityGateIssue[] = [];

  const [hasBlackFrames, maxVolumeDb, probe] = await Promise.all([
    detectBlackFrames(input.videoPath),
    detectAudioClipping(input.videoPath),
    probeMedia(input.videoPath),
  ]);

  if (hasBlackFrames) {
    issues.push({
      code: "black-frames",
      severity: "fail",
      message: "The rendered video contains one or more black frames.",
    });
  }

  if (maxVolumeDb !== null && maxVolumeDb >= MAX_VOLUME_CLIP_THRESHOLD_DB) {
    issues.push({
      code: "audio-clipping",
      severity: "fail",
      message: `Audio peaks at ${maxVolumeDb.toFixed(1)} dB, which clips.`,
    });
  }

  const durationDelta = Math.abs(probe.durationSec - input.expectedDurationSec);
  if (durationDelta > DURATION_TOLERANCE_SEC) {
    issues.push({
      code: "timing-desync",
      severity: "fail",
      message: `Rendered duration (${probe.durationSec.toFixed(1)}s) doesn't match the expected timeline (${input.expectedDurationSec.toFixed(1)}s).`,
    });
  }

  const scriptText = Object.values(input.script).join(" ");
  const scriptIsArabic = isArabicScript(scriptText);
  if (input.companyLocale === "AR" && !scriptIsArabic) {
    issues.push({
      code: "locale-mismatch",
      severity: "warning",
      message: "Company locale is Arabic but the script doesn't contain Arabic text.",
    });
  }
  if (input.companyLocale === "EN" && scriptIsArabic) {
    issues.push({
      code: "locale-mismatch",
      severity: "warning",
      message: "Script contains Arabic text but the company locale is set to English.",
    });
  }

  return {
    passed: !issues.some((issue) => issue.severity === "fail"),
    issues,
  };
}

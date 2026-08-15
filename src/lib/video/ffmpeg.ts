import "server-only";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";

const execFileAsync = promisify(execFile);

export const FFMPEG_PATH = ffmpegInstaller.path;
export const FFPROBE_PATH = ffprobeInstaller.path;

export class FfmpegError extends Error {
  constructor(
    message: string,
    public stderr: string,
  ) {
    super(message);
    this.name = "FfmpegError";
  }
}

export async function runFfmpeg(args: string[]): Promise<{ stdout: string; stderr: string }> {
  try {
    return await execFileAsync(FFMPEG_PATH, ["-y", "-hide_banner", ...args], {
      maxBuffer: 1024 * 1024 * 64,
    });
  } catch (error) {
    const err = error as { message: string; stderr?: string };
    throw new FfmpegError(`ffmpeg failed: ${err.message}`, err.stderr ?? "");
  }
}

export async function runFfprobe(args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync(FFPROBE_PATH, args, { maxBuffer: 1024 * 1024 * 16 });
    return stdout;
  } catch (error) {
    const err = error as { message: string; stderr?: string };
    throw new FfmpegError(`ffprobe failed: ${err.message}`, err.stderr ?? "");
  }
}

export interface ProbeResult {
  durationSec: number;
  width?: number;
  height?: number;
  hasAudio: boolean;
  hasVideo: boolean;
}

export async function probeMedia(filePath: string): Promise<ProbeResult> {
  const stdout = await runFfprobe([
    "-v",
    "quiet",
    "-print_format",
    "json",
    "-show_format",
    "-show_streams",
    filePath,
  ]);

  const data = JSON.parse(stdout) as {
    format?: { duration?: string };
    streams?: { codec_type?: string; width?: number; height?: number }[];
  };

  const videoStream = data.streams?.find((s) => s.codec_type === "video");
  const audioStream = data.streams?.find((s) => s.codec_type === "audio");

  return {
    durationSec: Number(data.format?.duration ?? 0),
    width: videoStream?.width,
    height: videoStream?.height,
    hasAudio: !!audioStream,
    hasVideo: !!videoStream,
  };
}

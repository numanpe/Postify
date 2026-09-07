import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

import type { VideoMusicMood } from "@prisma/client";
import type { Industry } from "@/lib/industry-packs";

const MUSIC_DIR = path.join(process.cwd(), "assets", "music");

const MOOD_FILES: Record<VideoMusicMood, string> = {
  CALM: "calm-wallpaper.mp3",
  CONFIDENT: "confident-deliberate-thought.mp3",
  UPBEAT: "upbeat-life-of-riley.mp3",
  WARM: "warm-inspired.mp3",
};

// A small bundled library, not a BYOK provider — see
// assets/music/README.md for why. Each industry maps to one of four
// moods so different company profiles don't all get identical music by
// default; a real per-video pick (Music Picker, 2026-09-07) always
// overrides this.
const INDUSTRY_MOOD: Record<Industry, VideoMusicMood> = {
  Agriculture: "WARM",
  "Construction & Engineering": "CONFIDENT",
  Education: "UPBEAT",
  "Real Estate": "CALM",
  Healthcare: "CALM",
  "Retail & E-commerce": "UPBEAT",
  "Hospitality & Food": "WARM",
  "Professional Services": "CONFIDENT",
  Other: "CALM",
};

export interface MusicTrackOption {
  mood: VideoMusicMood;
  // Real proper nouns, same titles already surfaced for CC BY 4.0
  // attribution in Settings' MusicCredits (music-credits.tsx) — kept as
  // one shared list rather than redefined here, so a track picked by
  // name in the editor matches the exact same name shown there.
  title: string;
  composer: string;
}

export const MUSIC_TRACK_OPTIONS: MusicTrackOption[] = [
  { mood: "CALM", title: "Wallpaper", composer: "Kevin MacLeod" },
  { mood: "CONFIDENT", title: "Deliberate Thought", composer: "Kevin MacLeod" },
  { mood: "UPBEAT", title: "Life of Riley", composer: "Kevin MacLeod" },
  { mood: "WARM", title: "Inspired", composer: "Kevin MacLeod" },
];

// Real per-video music resolution: an explicit user choice (Video.
// musicTrack) always wins; null preserves the original, still-default
// industry-based auto-selection.
export async function getMusicTrack(industry: Industry, explicitTrack: VideoMusicMood | null): Promise<Buffer> {
  const mood = explicitTrack ?? INDUSTRY_MOOD[industry];
  const fileName = MOOD_FILES[mood];
  return readFile(path.join(MUSIC_DIR, fileName));
}

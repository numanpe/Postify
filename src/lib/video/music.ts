import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

import type { Industry } from "@/lib/industry-packs";

type Mood = "calm" | "confident" | "upbeat" | "warm";

const MUSIC_DIR = path.join(process.cwd(), "assets", "music");

const MOOD_FILES: Record<Mood, string> = {
  calm: "calm-wallpaper.mp3",
  confident: "confident-deliberate-thought.mp3",
  upbeat: "upbeat-life-of-riley.mp3",
  warm: "warm-inspired.mp3",
};

// A small bundled library, not a BYOK provider — see
// assets/music/README.md for why. Each industry maps to one of four
// moods so different company profiles don't all get identical music.
const INDUSTRY_MOOD: Record<Industry, Mood> = {
  Agriculture: "warm",
  "Construction & Engineering": "confident",
  Education: "upbeat",
  "Real Estate": "calm",
  Healthcare: "calm",
  "Retail & E-commerce": "upbeat",
  "Hospitality & Food": "warm",
  "Professional Services": "confident",
  Other: "calm",
};

export async function getMusicForIndustry(industry: Industry): Promise<Buffer> {
  const fileName = MOOD_FILES[INDUSTRY_MOOD[industry]];
  return readFile(path.join(MUSIC_DIR, fileName));
}

import type { VideoScriptSections } from "@/lib/providers/text/types";
import type { WordTimestamp } from "@/lib/providers/voice/types";

export const SCRIPT_SECTION_KEYS = ["hook", "context", "value", "message", "cta"] as const;
export type ScriptSectionKey = (typeof SCRIPT_SECTION_KEYS)[number];

export interface SectionTiming {
  // string, not ScriptSectionKey — the scene editor (scene-editor.ts)
  // lets free-tier (non-narrated) videos add scenes beyond the fixed 5
  // script sections, so a scene's key can't always be one of the 5
  // literal names. Only ever compared against "hook"/"cta" in one place
  // (render.ts's LOWER_THIRD_PROMO banner lookup), which still works
  // fine against a plain string.
  key: string;
  text: string;
  startSec: number;
  endSec: number;
}

// Used only when there's no narration to time against (free tier — see
// README.md). Each section gets a fixed on-screen duration instead of
// audio-derived timing.
const FALLBACK_SECTION_DURATION_SEC = 4.5;

// Empty/whitespace-only section text is treated as "this scene was
// removed" (scene-editor.ts's script editor lets a user delete a
// section's text entirely to remove that scene) — skipped here rather
// than producing a real 0-duration or blank-caption scene. A normal
// generation never produces empty section text on its own, so this is
// purely additive for the original generation path.
export function computeSectionTimingsWithoutNarration(script: VideoScriptSections): SectionTiming[] {
  let cursor = 0;
  const timings: SectionTiming[] = [];
  for (const key of SCRIPT_SECTION_KEYS) {
    const text = script[key];
    if (!text.trim()) continue;
    const startSec = cursor;
    const endSec = cursor + FALLBACK_SECTION_DURATION_SEC;
    cursor = endSec;
    timings.push({ key, text, startSec, endSec });
  }
  return timings;
}

// The free-tier scene editor's own timing source — each scene carries
// its own user-set duration (VideoScene.durationSec) instead of the
// fixed FALLBACK_SECTION_DURATION_SEC every scene otherwise shares.
// Safe only where there's no real narration audio to desync from (see
// scene-editor.ts's doc comment on why duration adjustment is
// narrated-video-unsafe) — this is that codepath's real timing builder.
export function computeSectionTimingsFromDurations(
  scenes: { key: string; text: string; durationSec: number }[],
): SectionTiming[] {
  let cursor = 0;
  return scenes.map((scene) => {
    const startSec = cursor;
    const endSec = cursor + scene.durationSec;
    cursor = endSec;
    return { key: scene.key, text: scene.text, startSec, endSec };
  });
}

// Whisper's word list should closely mirror the input text in order,
// so section boundaries are assigned by matching cumulative word
// counts from the known per-section text, not by re-parsing the
// transcript text itself. A small drift is possible if Whisper splits
// or merges a word differently than a naive whitespace split (e.g.
// contractions) — any leftover words land in the final section rather
// than being silently dropped.
export function computeSectionTimingsFromWords(
  script: VideoScriptSections,
  words: WordTimestamp[],
): SectionTiming[] {
  let cursor = 0;
  const timings: SectionTiming[] = [];
  // Same "empty text = removed scene" contract as
  // computeSectionTimingsWithoutNarration — the last NON-EMPTY section
  // absorbs any leftover words (Whisper transcript drift), not
  // necessarily script's literal last key, since that key may itself
  // have been removed.
  const activeKeys = SCRIPT_SECTION_KEYS.filter((key) => script[key].trim());

  for (const key of activeKeys) {
    const text = script[key];
    const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
    const isLast = key === activeKeys[activeKeys.length - 1];

    const sectionWords = words.slice(cursor, cursor + wordCount);
    cursor += wordCount;
    const allSectionWords = isLast ? [...sectionWords, ...words.slice(cursor)] : sectionWords;

    const previousEnd = timings[timings.length - 1]?.endSec ?? 0;
    const startSec = allSectionWords[0]?.startSec ?? previousEnd;
    const endSec = allSectionWords[allSectionWords.length - 1]?.endSec ?? startSec + 0.1;

    timings.push({ key, text, startSec, endSec });
  }

  return timings;
}

import type { VideoScriptSections } from "@/lib/providers/text/types";
import type { WordTimestamp } from "@/lib/providers/voice/types";

export const SCRIPT_SECTION_KEYS = ["hook", "context", "value", "message", "cta"] as const;
export type ScriptSectionKey = (typeof SCRIPT_SECTION_KEYS)[number];

export interface SectionTiming {
  key: ScriptSectionKey;
  text: string;
  startSec: number;
  endSec: number;
}

// Used only when there's no narration to time against (free tier — see
// README.md). Each section gets a fixed on-screen duration instead of
// audio-derived timing.
const FALLBACK_SECTION_DURATION_SEC = 4.5;

export function computeSectionTimingsWithoutNarration(script: VideoScriptSections): SectionTiming[] {
  let cursor = 0;
  return SCRIPT_SECTION_KEYS.map((key) => {
    const startSec = cursor;
    const endSec = cursor + FALLBACK_SECTION_DURATION_SEC;
    cursor = endSec;
    return { key, text: script[key], startSec, endSec };
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

  for (const key of SCRIPT_SECTION_KEYS) {
    const text = script[key];
    const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
    const isLast = key === SCRIPT_SECTION_KEYS[SCRIPT_SECTION_KEYS.length - 1];

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

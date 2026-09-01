import "server-only";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";

import { getBundledFonts } from "@/lib/fonts";
import { detectDirection } from "@/lib/poster/direction";
import type { WordTimestamp } from "@/lib/providers/voice/types";

export interface CaptionChunk {
  text: string;
  startSec: number;
  endSec: number;
}

// Real, current TikTok/Reels safe-zone requirement (verified against
// 2026 platform guidance, not guessed): the bottom ~21-25% of a 9:16
// canvas is reserved for the platform's own UI (username, caption,
// hashtags, audio ticker, nav bar), which can obscure or visually
// clash with anything burned into the video itself underneath it.
// render.ts's own overlayBandBottomMargin (lower-thirds, waveform
// band) already used this real number — this caption renderer never
// did, using a much smaller height*0.1 instead, a real, confirmed bug
// (captions sitting inside TikTok's own reserved UI zone). One shared
// constant now, not two that can silently drift apart again — the
// exact class of bug already found once this session in the media
// picker queries.
export const SAFE_ZONE_BOTTOM_MARGIN_RATIO = 0.23;

export interface RenderedCaption extends CaptionChunk {
  png: Buffer;
}

// Groups word-level timestamps into short, readable on-screen chunks
// (a handful of words or ~2.5s of speech, whichever comes first) —
// standard "karaoke-accurate" captioning: timed to word-level
// precision without flashing one word at a time.
//
// sectionBoundaries: each script section's real endSec (from
// computeSectionTimingsFromWords via each scene's own section) — a
// chunk in progress is always flushed before crossing one, so a
// caption never mixes the tail of one script section with the head of
// the next. Real, confirmed-live bug (2026-09-01 acceptance test,
// recurring across every industry tested): the narration for a whole
// script is one flat word list (sections joined with " ... " before
// TTS — see generateNarrationWithFallback's fullScriptText), and the
// "..." itself gets no word-timestamp event, so a 4-word/2.5s window
// could straddle that gap. The words ARE in real spoken order either
// way (never scrambled) — the bug is a chunk like "to your family
// Every" reading as a confusing non-sequitur because it silently
// splices the end of one sentence to the start of an unrelated one.
export function chunkWordsIntoCaptions(
  words: WordTimestamp[],
  sectionBoundaries: number[] = [],
  maxWords = 4,
  maxDurationSec = 2.5,
): CaptionChunk[] {
  const chunks: CaptionChunk[] = [];
  let current: WordTimestamp[] = [];
  let boundaryIndex = 0;

  const flush = () => {
    if (current.length === 0) return;
    chunks.push({
      text: current.map((w) => w.word).join(" ").trim(),
      startSec: current[0].startSec,
      endSec: current[current.length - 1].endSec,
    });
    current = [];
  };

  for (const word of words) {
    while (boundaryIndex < sectionBoundaries.length && word.startSec >= sectionBoundaries[boundaryIndex]) {
      flush();
      boundaryIndex += 1;
    }

    current.push(word);
    const duration = word.endSec - current[0].startSec;
    if (current.length >= maxWords || duration >= maxDurationSec) {
      flush();
    }
  }
  flush();

  return chunks;
}

// Renders one caption chunk as a transparent PNG at the full video
// canvas size, text positioned in the lower third — reuses the same
// Satori+resvg RTL-correct rendering as the poster pipeline instead of
// ffmpeg's drawtext, which doesn't do bidi reshaping/reordering on its
// own and would render Arabic captions incorrectly.
export async function renderCaptionPng(text: string, width: number, height: number): Promise<Buffer> {
  const direction = detectDirection(text);
  const fonts = await getBundledFonts();

  const scaleBasis = Math.min(width, height);
  const fontSize = Math.round(scaleBasis * 0.045);
  const sidePadding = Math.round(scaleBasis * 0.08);

  const tree = (
    <div style={{ width, height, display: "flex", position: "relative" }}>
      <div
        style={{
          position: "absolute",
          left: sidePadding,
          right: sidePadding,
          bottom: Math.round(height * SAFE_ZONE_BOTTOM_MARGIN_RATIO),
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            background: "rgba(0,0,0,0.72)",
            color: "#ffffff",
            fontSize,
            fontWeight: 700,
            lineHeight: 1.25,
            padding: `${Math.round(fontSize * 0.4)}px ${Math.round(fontSize * 0.7)}px`,
            borderRadius: Math.round(fontSize * 0.3),
            textAlign: "center",
            direction,
            fontFamily: direction === "rtl" ? "Tajawal" : "Lato",
          }}
        >
          {text}
        </div>
      </div>
    </div>
  );

  const svg = await satori(tree, {
    width,
    height,
    fonts: [
      { name: "Lato", data: fonts.latinRegular, weight: 400, style: "normal" },
      { name: "Lato", data: fonts.latinBold, weight: 700, style: "normal" },
      { name: "Tajawal", data: fonts.arabicRegular, weight: 400, style: "normal" },
      { name: "Tajawal", data: fonts.arabicBold, weight: 700, style: "normal" },
    ],
  });

  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: width } });
  return Buffer.from(resvg.render().asPng());
}

export async function renderCaptionChunks(
  chunks: CaptionChunk[],
  width: number,
  height: number,
): Promise<RenderedCaption[]> {
  const rendered: RenderedCaption[] = [];
  for (const chunk of chunks) {
    const png = await renderCaptionPng(chunk.text, width, height);
    rendered.push({ ...chunk, png });
  }
  return rendered;
}

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

export interface RenderedCaption extends CaptionChunk {
  png: Buffer;
}

// Groups word-level timestamps into short, readable on-screen chunks
// (a handful of words or ~2.5s of speech, whichever comes first) —
// standard "karaoke-accurate" captioning: timed to word-level
// precision without flashing one word at a time.
export function chunkWordsIntoCaptions(
  words: WordTimestamp[],
  maxWords = 4,
  maxDurationSec = 2.5,
): CaptionChunk[] {
  const chunks: CaptionChunk[] = [];
  let current: WordTimestamp[] = [];

  for (const word of words) {
    current.push(word);
    const duration = word.endSec - current[0].startSec;
    if (current.length >= maxWords || duration >= maxDurationSec) {
      chunks.push({
        text: current.map((w) => w.word).join(" ").trim(),
        startSec: current[0].startSec,
        endSec: word.endSec,
      });
      current = [];
    }
  }
  if (current.length > 0) {
    chunks.push({
      text: current.map((w) => w.word).join(" ").trim(),
      startSec: current[0].startSec,
      endSec: current[current.length - 1].endSec,
    });
  }

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
          bottom: Math.round(height * 0.1),
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

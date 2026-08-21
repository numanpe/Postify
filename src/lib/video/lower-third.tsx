import "server-only";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";

import { getBundledFonts } from "@/lib/fonts";
import { detectDirection, type TextDirection } from "@/lib/poster/direction";

export interface RenderedLowerThird {
  png: Buffer;
  width: number;
  height: number;
  direction: TextDirection;
}

function truncate(text: string, max: number): string {
  const trimmed = text.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max - 1).trimEnd()}…` : trimmed;
}

// Renders a fixed-size broadcast-style lower-third banner (not the
// full video canvas, unlike renderCaptionPng) — its own bounding box
// only, so render.ts can slide it on/off screen via a keyframed
// ffmpeg overlay x-expression instead of baking position into the
// image itself. Same Satori+resvg RTL-correct text engine as captions
// and posters, for the same reason: ffmpeg drawtext doesn't do bidi
// reshaping and would render Arabic text incorrectly.
export async function renderLowerThirdBannerPng(
  primaryText: string,
  secondaryText: string,
  canvasWidth: number,
  canvasHeight: number,
  accentColor?: string | null,
): Promise<RenderedLowerThird> {
  const direction = detectDirection(primaryText) === "rtl" || detectDirection(secondaryText) === "rtl" ? "rtl" : "ltr";
  const fonts = await getBundledFonts();

  // Real generated hook/CTA lines vary in length and Satori doesn't
  // expose measured text width pre-render, so a fixed banner height
  // can't reliably guarantee the primary text fits a given line count
  // — a real dry-run test caught this twice: first a 2-line wrap
  // crowding the company-name line, then (after reserving room for 2
  // lines) a longer real CTA line wrapping to 3 and crowding it again.
  // Reserving 3 lines plus a tighter truncation cap is the safety
  // margin — some blank space under a short line is a minor cosmetic
  // imperfection; overlapping text is a real broken-output failure.
  const width = Math.round(canvasWidth * 0.72);
  const primaryFontSize = Math.round(canvasHeight * 0.028);
  const secondaryFontSize = Math.round(canvasHeight * 0.017);
  const primaryLineHeight = 1.15;
  const maxPrimaryLines = 3;
  const gapBetween = Math.round(canvasHeight * 0.012);
  const paddingV = Math.round(canvasHeight * 0.018);
  const paddingH = Math.round(canvasHeight * 0.03);
  const height =
    Math.round(primaryFontSize * primaryLineHeight * maxPrimaryLines) +
    gapBetween +
    secondaryFontSize +
    paddingV * 2;
  const accent = accentColor && /^#[0-9a-fA-F]{6}$/.test(accentColor) ? accentColor : "#e0483e";

  const primary = truncate(primaryText, 50);
  const secondary = truncate(secondaryText, 34);

  const tree = (
    <div
      style={{
        width,
        height,
        display: "flex",
        flexDirection: direction === "rtl" ? "row-reverse" : "row",
        alignItems: "stretch",
      }}
    >
      <div style={{ display: "flex", width: Math.round(width * 0.015), background: accent }} />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          flex: 1,
          background: "rgba(10,10,10,0.78)",
          padding: `${paddingV}px ${paddingH}px`,
          direction,
          textAlign: direction === "rtl" ? "right" : "left",
        }}
      >
        <div
          style={{
            display: "flex",
            color: "#ffffff",
            fontSize: primaryFontSize,
            fontWeight: 700,
            lineHeight: primaryLineHeight,
            fontFamily: direction === "rtl" ? "Tajawal" : "Lato",
          }}
        >
          {primary}
        </div>
        <div
          style={{
            display: "flex",
            color: "rgba(255,255,255,0.78)",
            fontSize: secondaryFontSize,
            fontWeight: 400,
            marginTop: gapBetween,
            fontFamily: direction === "rtl" ? "Tajawal" : "Lato",
          }}
        >
          {secondary}
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
  const png = Buffer.from(resvg.render().asPng());
  return { png, width, height, direction };
}

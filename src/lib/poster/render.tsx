import "server-only";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import type { AspectRatio } from "@prisma/client";

import { POSTER_DIMENSIONS } from "./dimensions";
import { detectDirection, type TextDirection } from "./direction";
import { getPosterFonts } from "./fonts";
import { readableTextColor } from "./contrast";

export interface RenderPosterInput {
  headline: string;
  subhead?: string | null;
  cta?: string | null;
  aspectRatio: AspectRatio;
  backgroundBuffer: Buffer;
  backgroundMimeType: string;
  logoBuffer?: Buffer | null;
  logoMimeType?: string | null;
  brandColors: {
    primary?: string | null;
    secondary?: string | null;
    accent?: string | null;
  };
}

export interface RenderPosterOutput {
  png: Buffer;
  width: number;
  height: number;
  direction: TextDirection;
}

function toDataUri(buffer: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

// Single adaptive layout across all three aspect ratios — sizes scale
// from canvas width rather than three separate hardcoded templates.
// Background photo/gradient -> dark bottom scrim (guarantees headline
// contrast regardless of the underlying image, verified after the fact
// by the quality gate) -> logo (object-fit: contain, never stretched)
// -> headline/subhead/CTA anchored to the reading-direction-appropriate
// corner. RTL is driven by the headline's actual script, not a stored
// company locale — see direction.ts.
export async function renderPoster(input: RenderPosterInput): Promise<RenderPosterOutput> {
  const { width, height } = POSTER_DIMENSIONS[input.aspectRatio];
  const direction = detectDirection(input.headline);
  const fonts = await getPosterFonts();

  // Sized off the SHORTER canvas dimension, not width alone — LANDSCAPE
  // is much wider than it is tall (1920x1080), so width-based sizing
  // would make text consume a dangerously large fraction of its limited
  // height. min(width, height) happens to be 1080 for all three
  // supported aspect ratios, so this also makes headline/subhead/CTA
  // sizes consistent across formats. quality-gate.ts's contrast
  // guarantee assumes this exact scale basis — keep them in sync.
  const scaleBasis = Math.min(width, height);
  const headlineFontSize = Math.round(scaleBasis * 0.065);
  const subheadFontSize = Math.round(scaleBasis * 0.03);
  const ctaFontSize = Math.round(scaleBasis * 0.024);
  const padding = Math.round(scaleBasis * 0.06);

  const ctaBackground = input.brandColors.accent ?? input.brandColors.primary ?? "#111111";
  const ctaTextColor = readableTextColor(ctaBackground);

  const backgroundDataUri = toDataUri(input.backgroundBuffer, input.backgroundMimeType);
  const logoDataUri = input.logoBuffer
    ? toDataUri(input.logoBuffer, input.logoMimeType ?? "image/png")
    : null;
  const fontFamily = direction === "rtl" ? "Tajawal" : "Lato";
  const textAlign = direction === "rtl" ? "right" : "left";

  // This JSX is a Satori element tree, not browser-rendered DOM — it's
  // consumed by satori() below to produce SVG. next/image and DOM a11y
  // tooling don't apply here (Satori doesn't understand next/image),
  // hence the disables; alt="" is still accurate since these are
  // compositional layers, not user-facing images in a page.
  /* eslint-disable @next/next/no-img-element */
  const tree = (
    <div style={{ width, height, display: "flex", position: "relative", fontFamily }}>
      <img
        src={backgroundDataUri}
        alt=""
        style={{ position: "absolute", top: 0, left: 0, width, height, objectFit: "cover" }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width,
          height,
          display: "flex",
          // Kept in sync with SCRIM_STOPS in quality-gate.ts — the gate's
          // contrast guarantee is only valid if these numbers match.
          background:
            "linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.55) 42%, rgba(0,0,0,0) 75%)",
        }}
      />
      {logoDataUri && (
        <img
          src={logoDataUri}
          alt=""
          style={{
            position: "absolute",
            top: Math.round(padding * 0.6),
            left: Math.round(padding * 0.6),
            maxHeight: Math.round(height * 0.1),
            maxWidth: Math.round(width * 0.28),
            objectFit: "contain",
          }}
        />
      )}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width,
          display: "flex",
          flexDirection: "column",
          alignItems: direction === "rtl" ? "flex-end" : "flex-start",
          padding,
          gap: Math.round(scaleBasis * 0.02),
          direction,
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: headlineFontSize,
            fontWeight: 700,
            color: "#ffffff",
            lineHeight: 1.15,
            textAlign,
          }}
        >
          {input.headline}
        </div>
        {input.subhead && (
          <div
            style={{
              display: "flex",
              fontSize: subheadFontSize,
              fontWeight: 400,
              color: "rgba(255,255,255,0.92)",
              lineHeight: 1.3,
              textAlign,
            }}
          >
            {input.subhead}
          </div>
        )}
        {input.cta && (
          <div
            style={{
              display: "flex",
              marginTop: Math.round(scaleBasis * 0.01),
              padding: `${Math.round(scaleBasis * 0.014)}px ${Math.round(scaleBasis * 0.028)}px`,
              borderRadius: Math.round(scaleBasis * 0.4),
              background: ctaBackground,
              color: ctaTextColor,
              fontSize: ctaFontSize,
              fontWeight: 700,
            }}
          >
            {input.cta}
          </div>
        )}
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
  const png = resvg.render().asPng();

  return { png: Buffer.from(png), width, height, direction };
}

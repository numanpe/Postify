// Satori element trees, not browser-rendered DOM — consumed by satori()
// in render.tsx to produce SVG. next/image and DOM a11y tooling don't
// apply here (Satori doesn't understand next/image); alt="" is still
// accurate since these are compositional layers, not user-facing images
// in a page.
/* eslint-disable @next/next/no-img-element */
import type { ReactElement } from "react";
import type { AspectRatio, PosterTemplate } from "@prisma/client";

import { readableTextColor } from "./contrast";
import type { TextDirection } from "./direction";
import type { ScrimStops, TemplateContrastSpec } from "./quality-gate";
import { scaleBasisFor } from "./quality-gate";
import { DEFAULT_GRADIENT } from "@/lib/providers/image/gradient-provider";

export interface TemplateRenderProps {
  headline: string;
  subhead?: string | null;
  cta?: string | null;
  direction: TextDirection;
  fontFamily: string;
  textAlign: "left" | "right";
  width: number;
  height: number;
  backgroundDataUri: string;
  logoDataUri: string | null;
  brandColors: { primary?: string | null; secondary?: string | null; accent?: string | null };
}

export interface PosterTemplateDefinition {
  id: PosterTemplate;
  name: string;
  description: string;
  contrastSpec: TemplateContrastSpec;
  render: (props: TemplateRenderProps) => ReactElement;
}

// Shared by every bottom-anchored, text-over-photo template (MINIMAL,
// BOLD_HEADLINE) — the worst-case block height the quality gate proves
// contrast against assumes 3 wrapped headline lines + 2 wrapped subhead
// lines + a CTA badge all present at once (real posts are usually
// shorter). Keeping this in one place means render.tsx's actual JSX and
// quality-gate.ts's prediction can never drift apart from each other.
interface BottomStackSizes {
  headlineFontSize: number; // fraction of scaleBasis
  subheadFontSize: number;
  ctaFontSize: number;
  padding: number;
  gap: number;
  ctaVerticalPadding: number;
}

// scaleBasis (min of width/height) drives font/spacing sizes uniformly
// across formats, but the fraction itself must be measured against the
// REAL canvas height — for STORY (1080x1920) those differ, and dividing
// by scaleBasis there would overstate how far up the block reaches.
function bottomStackNearEdgeFraction(aspectRatio: AspectRatio, sizes: BottomStackSizes): number {
  const scaleBasis = scaleBasisFor(aspectRatio);
  const headlineBlock = sizes.headlineFontSize * scaleBasis * 1.15 * 3;
  const subheadBlock = sizes.subheadFontSize * scaleBasis * 1.3 * 2;
  const ctaBlock = sizes.ctaFontSize * scaleBasis + 2 * sizes.ctaVerticalPadding * scaleBasis;
  const gapPx = sizes.gap * scaleBasis;
  const paddingPx = sizes.padding * scaleBasis;
  const totalPx = paddingPx + headlineBlock + gapPx + subheadBlock + gapPx + ctaBlock;
  const realHeight = aspectRatioHeight(aspectRatio);
  return totalPx / realHeight;
}

function aspectRatioHeight(aspectRatio: AspectRatio): number {
  // Mirrors dimensions.ts without importing POSTER_DIMENSIONS twice —
  // quality-gate.ts already re-exports the same source of truth via
  // scaleBasisFor; this reads the height half of the same table.
  const table: Record<AspectRatio, number> = { SQUARE: 1080, STORY: 1920, LANDSCAPE: 1080 };
  return table[aspectRatio];
}

// Returns only the relevant side key — Satori's style parser calls
// .trim() on every style value it receives, so a spread key explicitly
// set to `undefined` (e.g. `{ right: padding, left: undefined }`)
// crashes the render rather than being ignored like real CSS/DOM would.
function logoPosition(direction: TextDirection, padding: number): { left: number } | { right: number } {
  return direction === "rtl" ? { right: padding } : { left: padding };
}

// ---------- MINIMAL ----------
// The original design, kept as the understated default: full photo,
// bottom-anchored text under a graduated scrim, small corner logo.
const MINIMAL_SIZES: BottomStackSizes = {
  headlineFontSize: 0.065,
  subheadFontSize: 0.03,
  ctaFontSize: 0.024,
  padding: 0.06,
  gap: 0.02,
  ctaVerticalPadding: 0.014,
};
const MINIMAL_SCRIM: ScrimStops = [
  [0, 0.88],
  [0.42, 0.55],
  [0.75, 0],
  [1, 0],
];

function renderMinimal(props: TemplateRenderProps): ReactElement {
  const { width, height } = props;
  const scaleBasis = Math.min(width, height);
  const padding = Math.round(scaleBasis * MINIMAL_SIZES.padding);
  const ctaBackground = props.brandColors.accent ?? props.brandColors.primary ?? DEFAULT_GRADIENT[0];
  const ctaTextColor = readableTextColor(ctaBackground);
  const logoPos = logoPosition(props.direction, Math.round(padding * 0.6));

  return (
    <div style={{ width, height, display: "flex", position: "relative", fontFamily: props.fontFamily }}>
      <img src={props.backgroundDataUri} alt="" style={{ position: "absolute", top: 0, left: 0, width, height, objectFit: "cover" }} />
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width,
          height,
          display: "flex",
          background: "linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.55) 42%, rgba(0,0,0,0) 75%)",
        }}
      />
      {props.logoDataUri && (
        <img
          src={props.logoDataUri}
          alt=""
          style={{
            position: "absolute",
            top: Math.round(padding * 0.6),
            ...logoPos,
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
          alignItems: props.direction === "rtl" ? "flex-end" : "flex-start",
          padding,
          gap: Math.round(scaleBasis * 0.02),
          direction: props.direction,
        }}
      >
        <div style={{ display: "flex", fontSize: Math.round(scaleBasis * MINIMAL_SIZES.headlineFontSize), fontWeight: 700, color: "#ffffff", lineHeight: 1.15, textAlign: props.textAlign }}>
          {props.headline}
        </div>
        {props.subhead && (
          <div style={{ display: "flex", fontSize: Math.round(scaleBasis * MINIMAL_SIZES.subheadFontSize), fontWeight: 400, color: "rgba(255,255,255,0.92)", lineHeight: 1.3, textAlign: props.textAlign }}>
            {props.subhead}
          </div>
        )}
        {props.cta && (
          <div
            style={{
              display: "flex",
              marginTop: Math.round(scaleBasis * 0.01),
              padding: `${Math.round(scaleBasis * MINIMAL_SIZES.ctaVerticalPadding)}px ${Math.round(scaleBasis * 0.028)}px`,
              borderRadius: Math.round(scaleBasis * 0.4),
              background: ctaBackground,
              color: ctaTextColor,
              fontSize: Math.round(scaleBasis * MINIMAL_SIZES.ctaFontSize),
              fontWeight: 700,
            }}
          >
            {props.cta}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- BOLD_HEADLINE ----------
// Same bottom-anchor structure as MINIMAL (proven, safe), but a much
// larger headline and a scrim with a guaranteed 40% floor across the
// ENTIRE image (not just near the text) — the "40% dark overlay" —
// ramping up higher right behind the text for the extra contrast margin
// large type needs.
const BOLD_SIZES: BottomStackSizes = {
  headlineFontSize: 0.09,
  subheadFontSize: 0.032,
  ctaFontSize: 0.026,
  padding: 0.07,
  gap: 0.022,
  ctaVerticalPadding: 0.016,
};
const BOLD_SCRIM: ScrimStops = [
  [0, 0.4],
  [0.3, 0.45],
  [0.6, 0.65],
  [1, 0.9],
];

function renderBoldHeadline(props: TemplateRenderProps): ReactElement {
  const { width, height } = props;
  const scaleBasis = Math.min(width, height);
  const padding = Math.round(scaleBasis * BOLD_SIZES.padding);
  const ctaBackground = props.brandColors.accent ?? props.brandColors.primary ?? DEFAULT_GRADIENT[0];
  const ctaTextColor = readableTextColor(ctaBackground);
  const logoPos = logoPosition(props.direction, Math.round(padding * 0.6));

  return (
    <div style={{ width, height, display: "flex", position: "relative", fontFamily: props.fontFamily }}>
      <img src={props.backgroundDataUri} alt="" style={{ position: "absolute", top: 0, left: 0, width, height, objectFit: "cover" }} />
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width,
          height,
          display: "flex",
          background: "linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.65) 30%, rgba(0,0,0,0.45) 60%, rgba(0,0,0,0.4) 100%)",
        }}
      />
      {props.logoDataUri && (
        <img
          src={props.logoDataUri}
          alt=""
          style={{
            position: "absolute",
            top: Math.round(padding * 0.6),
            ...logoPos,
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
          alignItems: props.direction === "rtl" ? "flex-end" : "flex-start",
          padding,
          gap: Math.round(scaleBasis * BOLD_SIZES.gap),
          direction: props.direction,
        }}
      >
        <div style={{ display: "flex", fontSize: Math.round(scaleBasis * BOLD_SIZES.headlineFontSize), fontWeight: 800, color: "#ffffff", lineHeight: 1.08, textAlign: props.textAlign }}>
          {props.headline}
        </div>
        {props.subhead && (
          <div style={{ display: "flex", fontSize: Math.round(scaleBasis * BOLD_SIZES.subheadFontSize), fontWeight: 400, color: "rgba(255,255,255,0.92)", lineHeight: 1.3, textAlign: props.textAlign }}>
            {props.subhead}
          </div>
        )}
        {props.cta && (
          <div
            style={{
              display: "flex",
              marginTop: Math.round(scaleBasis * 0.012),
              padding: `${Math.round(scaleBasis * BOLD_SIZES.ctaVerticalPadding)}px ${Math.round(scaleBasis * 0.032)}px`,
              borderRadius: Math.round(scaleBasis * 0.4),
              background: ctaBackground,
              color: ctaTextColor,
              fontSize: Math.round(scaleBasis * BOLD_SIZES.ctaFontSize),
              fontWeight: 700,
            }}
          >
            {props.cta}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- PROMOTIONAL_BANNER ----------
// Photo fills the top, a solid brand-color band holds the text below —
// nominally a ~70/30 split, but the band is auto-sized to its actual
// content (not a fixed pixel height) and the photo takes an explicit
// minHeight: 0 flex item, so long headline/subhead text grows the band
// and shrinks the photo instead of overflowing out of the solid color —
// the geometric guarantee PanelContrastSpec's "always passes" assumption
// depends on. Text sits on a known color, not a photo, so contrast
// itself is exact math (readableTextColor), not a worst-case estimate.
function renderPromotionalBanner(props: TemplateRenderProps): ReactElement {
  const { width, height } = props;
  const scaleBasis = Math.min(width, height);
  const bandColor = props.brandColors.primary ?? DEFAULT_GRADIENT[0];
  const bandTextColor = readableTextColor(bandColor);
  const padding = Math.round(scaleBasis * 0.06);
  const logoPos = logoPosition(props.direction, Math.round(padding * 0.6));

  return (
    <div style={{ width, height, display: "flex", flexDirection: "column", position: "relative", fontFamily: props.fontFamily }}>
      <div style={{ display: "flex", width, flex: 1, minHeight: 0, overflow: "hidden", position: "relative" }}>
        <img src={props.backgroundDataUri} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
      {props.logoDataUri && (
        <img
          src={props.logoDataUri}
          alt=""
          style={{
            position: "absolute",
            top: Math.round(padding * 0.6),
            ...logoPos,
            maxHeight: Math.round(height * 0.08),
            maxWidth: Math.round(width * 0.24),
            objectFit: "contain",
            padding: Math.round(scaleBasis * 0.015),
            borderRadius: Math.round(scaleBasis * 0.02),
            background: "rgba(0,0,0,0.35)",
          }}
        />
      )}
      <div
        style={{
          display: "flex",
          flexShrink: 0,
          flexDirection: "column",
          minHeight: Math.round(height * 0.26),
          justifyContent: "center",
          alignItems: props.direction === "rtl" ? "flex-end" : "flex-start",
          background: bandColor,
          padding,
          gap: Math.round(scaleBasis * 0.016),
          direction: props.direction,
        }}
      >
        <div style={{ display: "flex", fontSize: Math.round(scaleBasis * 0.06), fontWeight: 700, color: bandTextColor, lineHeight: 1.1, textAlign: props.textAlign }}>
          {props.headline}
        </div>
        {props.subhead && (
          <div style={{ display: "flex", fontSize: Math.round(scaleBasis * 0.028), fontWeight: 400, color: bandTextColor, opacity: 0.85, lineHeight: 1.3, textAlign: props.textAlign }}>
            {props.subhead}
          </div>
        )}
        {props.cta && (
          <div
            style={{
              display: "flex",
              marginTop: Math.round(scaleBasis * 0.008),
              padding: `${Math.round(scaleBasis * 0.012)}px ${Math.round(scaleBasis * 0.026)}px`,
              borderRadius: Math.round(scaleBasis * 0.4),
              border: `${Math.max(2, Math.round(scaleBasis * 0.003))}px solid ${bandTextColor}`,
              color: bandTextColor,
              fontSize: Math.round(scaleBasis * 0.022),
              fontWeight: 700,
            }}
          >
            {props.cta}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- SPLIT_PRODUCT ----------
// Photo fills the top, a solid panel below holds everything — headline,
// subhead, CTA, and the logo together — rather than floating the logo
// over the photo. Nominally a ~55/45 split, but as in PROMOTIONAL_BANNER
// the panel is auto-sized to its content and the photo is an explicit
// minHeight: 0 flex item, so long content grows the panel instead of
// overflowing out of the solid color. Same PanelContrastSpec guarantee,
// with a visually distinct proportion, logo placement, and CTA
// treatment from PROMOTIONAL_BANNER.
function renderSplitProduct(props: TemplateRenderProps): ReactElement {
  const { width, height } = props;
  const scaleBasis = Math.min(width, height);
  const panelColor = props.brandColors.secondary ?? props.brandColors.primary ?? DEFAULT_GRADIENT[1];
  const panelTextColor = readableTextColor(panelColor);
  const ctaBackground = props.brandColors.accent ?? panelTextColor;
  const ctaTextColor = readableTextColor(ctaBackground);
  const padding = Math.round(scaleBasis * 0.06);

  return (
    <div style={{ width, height, display: "flex", flexDirection: "column", position: "relative", fontFamily: props.fontFamily }}>
      <div style={{ display: "flex", width, flex: 1, minHeight: 0, overflow: "hidden", position: "relative" }}>
        <img src={props.backgroundDataUri} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
      <div
        style={{
          display: "flex",
          flexShrink: 0,
          flexDirection: "column",
          minHeight: Math.round(height * 0.4),
          justifyContent: "center",
          alignItems: props.direction === "rtl" ? "flex-end" : "flex-start",
          background: panelColor,
          padding,
          gap: Math.round(scaleBasis * 0.016),
          direction: props.direction,
        }}
      >
        {props.logoDataUri && (
          <img
            src={props.logoDataUri}
            alt=""
            style={{ maxHeight: Math.round(height * 0.07), maxWidth: Math.round(width * 0.3), objectFit: "contain", marginBottom: Math.round(scaleBasis * 0.008) }}
          />
        )}
        <div style={{ display: "flex", fontSize: Math.round(scaleBasis * 0.055), fontWeight: 700, color: panelTextColor, lineHeight: 1.12, textAlign: props.textAlign }}>
          {props.headline}
        </div>
        {props.subhead && (
          <div style={{ display: "flex", fontSize: Math.round(scaleBasis * 0.026), fontWeight: 400, color: panelTextColor, opacity: 0.85, lineHeight: 1.3, textAlign: props.textAlign }}>
            {props.subhead}
          </div>
        )}
        {props.cta && (
          <div
            style={{
              display: "flex",
              marginTop: Math.round(scaleBasis * 0.008),
              padding: `${Math.round(scaleBasis * 0.013)}px ${Math.round(scaleBasis * 0.028)}px`,
              borderRadius: Math.round(scaleBasis * 0.4),
              background: ctaBackground,
              color: ctaTextColor,
              fontSize: Math.round(scaleBasis * 0.023),
              fontWeight: 700,
            }}
          >
            {props.cta}
          </div>
        )}
      </div>
    </div>
  );
}

export const POSTER_TEMPLATES: Record<PosterTemplate, PosterTemplateDefinition> = {
  MINIMAL: {
    id: "MINIMAL",
    name: "Minimal",
    description: "Clean full-bleed photo with understated bottom text — quiet and versatile.",
    contrastSpec: { kind: "overlay", scrimStops: MINIMAL_SCRIM, headlineNearEdgeFraction: (ar) => bottomStackNearEdgeFraction(ar, MINIMAL_SIZES) },
    render: renderMinimal,
  },
  BOLD_HEADLINE: {
    id: "BOLD_HEADLINE",
    name: "Bold Headline",
    description: "Large, confident type over a consistently darkened photo — for a strong single message.",
    contrastSpec: { kind: "overlay", scrimStops: BOLD_SCRIM, headlineNearEdgeFraction: (ar) => bottomStackNearEdgeFraction(ar, BOLD_SIZES) },
    render: renderBoldHeadline,
  },
  PROMOTIONAL_BANNER: {
    id: "PROMOTIONAL_BANNER",
    name: "Promotional Banner",
    description: "Photo up top, a solid brand-color banner for the message below — maximum readability.",
    contrastSpec: { kind: "panel" },
    render: renderPromotionalBanner,
  },
  SPLIT_PRODUCT: {
    id: "SPLIT_PRODUCT",
    name: "Split Product View",
    description: "Photo and a solid brand panel side by side — logo, message, and CTA together in the panel.",
    contrastSpec: { kind: "panel" },
    render: renderSplitProduct,
  },
};

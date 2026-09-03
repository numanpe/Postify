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
  // INFOGRAPHIC_SHOWCASE only (see that template's own doc comment) —
  // every other template ignores these.
  companyName: string;
  benefits?: { headline: string; subtext: string }[];
  trustBadges?: string[];
  contact?: { phone: string | null; whatsapp: string | null; email: string | null; website: string | null };
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

// ---------- MODERN_BANNER ----------
// Reuses BOLD_HEADLINE's sizing AND scrim byte-for-byte — not a new,
// unverified scrim shape. (An earlier draft here invented its own
// lighter scrim and the real quality gate caught it failing at 2.52:1 —
// exactly the kind of mistake this shared-constants approach is meant to
// prevent. Reusing a already-proven-safe shape instead of hand-tuning a
// new one avoids re-deriving the worst-case math by eye.) The accent bar
// is the only new visual element, and it's purely decorative — a solid
// rect beside the text, never behind it — so it doesn't touch the
// contrast math at all.
const MODERN_BANNER_SIZES: BottomStackSizes = BOLD_SIZES;
const MODERN_BANNER_SCRIM: ScrimStops = BOLD_SCRIM;

function renderModernBanner(props: TemplateRenderProps): ReactElement {
  const { width, height } = props;
  const scaleBasis = Math.min(width, height);
  const padding = Math.round(scaleBasis * MODERN_BANNER_SIZES.padding);
  const accentColor = props.brandColors.accent ?? props.brandColors.primary ?? DEFAULT_GRADIENT[0];
  const ctaTextColor = readableTextColor(accentColor);
  const logoPos = logoPosition(props.direction, Math.round(padding * 0.6));
  const barWidth = Math.max(3, Math.round(scaleBasis * 0.012));

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
          // Identical gradient to BOLD_HEADLINE's — see the sizing/scrim
          // comment above for why this must stay byte-identical.
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
          // Row so the accent bar sits beside the text stack, flipped in
          // RTL so it stays on the text's leading edge either way.
          flexDirection: props.direction === "rtl" ? "row-reverse" : "row",
          alignItems: "stretch",
          padding,
          gap: Math.round(scaleBasis * 0.02),
        }}
      >
        <div style={{ display: "flex", width: barWidth, borderRadius: barWidth, background: accentColor }} />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: props.direction === "rtl" ? "flex-end" : "flex-start",
            gap: Math.round(scaleBasis * MODERN_BANNER_SIZES.gap),
            direction: props.direction,
          }}
        >
          <div style={{ display: "flex", fontSize: Math.round(scaleBasis * MODERN_BANNER_SIZES.headlineFontSize), fontWeight: 800, color: "#ffffff", lineHeight: 1.1, textAlign: props.textAlign }}>
            {props.headline}
          </div>
          {props.subhead && (
            <div style={{ display: "flex", fontSize: Math.round(scaleBasis * MODERN_BANNER_SIZES.subheadFontSize), fontWeight: 400, color: "rgba(255,255,255,0.92)", lineHeight: 1.3, textAlign: props.textAlign }}>
              {props.subhead}
            </div>
          )}
          {props.cta && (
            <div
              style={{
                display: "flex",
                marginTop: Math.round(scaleBasis * 0.01),
                padding: `${Math.round(scaleBasis * MODERN_BANNER_SIZES.ctaVerticalPadding)}px ${Math.round(scaleBasis * 0.028)}px`,
                borderRadius: Math.round(scaleBasis * 0.4),
                background: accentColor,
                color: ctaTextColor,
                fontSize: Math.round(scaleBasis * MODERN_BANNER_SIZES.ctaFontSize),
                fontWeight: 700,
              }}
            >
              {props.cta}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- BADGE_OFFER ----------
// Every piece of text (headline, subhead, CTA) sits inside one centered,
// solid accent-color card — never directly on the photo — so this is a
// PanelContrastSpec exactly like PROMOTIONAL_BANNER/SPLIT_PRODUCT:
// contrast is exact math via readableTextColor, not a worst-case
// estimate, regardless of which brand color the card ends up being.
function renderBadgeOffer(props: TemplateRenderProps): ReactElement {
  const { width, height } = props;
  const scaleBasis = Math.min(width, height);
  const cardColor = props.brandColors.accent ?? props.brandColors.primary ?? DEFAULT_GRADIENT[0];
  const cardTextColor = readableTextColor(cardColor);
  const padding = Math.round(scaleBasis * 0.07);
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
          // Just enough of a scrim that the card reads clearly against
          // any photo — the card itself (not this scrim) is what
          // guarantees text contrast.
          background: "rgba(0,0,0,0.25)",
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
            maxHeight: Math.round(height * 0.09),
            maxWidth: Math.round(width * 0.26),
            objectFit: "contain",
          }}
        />
      )}
      <div style={{ display: "flex", width, height, alignItems: "center", justifyContent: "center", padding: Math.round(scaleBasis * 0.08) }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            background: cardColor,
            borderRadius: Math.round(scaleBasis * 0.03),
            padding,
            gap: Math.round(scaleBasis * 0.02),
            direction: props.direction,
          }}
        >
          {props.cta && (
            <div
              style={{
                display: "flex",
                padding: `${Math.round(scaleBasis * 0.01)}px ${Math.round(scaleBasis * 0.022)}px`,
                borderRadius: Math.round(scaleBasis * 0.4),
                border: `${Math.max(2, Math.round(scaleBasis * 0.003))}px solid ${cardTextColor}`,
                color: cardTextColor,
                fontSize: Math.round(scaleBasis * 0.022),
                fontWeight: 700,
                letterSpacing: Math.round(scaleBasis * 0.002),
              }}
            >
              {props.cta}
            </div>
          )}
          <div style={{ display: "flex", fontSize: Math.round(scaleBasis * 0.065), fontWeight: 800, color: cardTextColor, lineHeight: 1.1, textAlign: "center" }}>
            {props.headline}
          </div>
          {props.subhead && (
            <div style={{ display: "flex", fontSize: Math.round(scaleBasis * 0.03), fontWeight: 400, color: cardTextColor, opacity: 0.85, lineHeight: 1.3, textAlign: "center" }}>
              {props.subhead}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- MINIMALIST_FRAME ----------
// Same proven bottom-anchor-over-photo structure as MINIMAL (an
// "overlay" contrastSpec, identical sizing/scrim strength), with two
// purely decorative additions that don't touch the contrast math: a
// thin brand-color border frame inset from the edges, and a larger,
// low-opacity logo watermark instead of a small opaque corner mark.
const MINIMALIST_FRAME_SIZES: BottomStackSizes = MINIMAL_SIZES;
const MINIMALIST_FRAME_SCRIM: ScrimStops = MINIMAL_SCRIM;

function renderMinimalistFrame(props: TemplateRenderProps): ReactElement {
  const { width, height } = props;
  const scaleBasis = Math.min(width, height);
  const padding = Math.round(scaleBasis * MINIMALIST_FRAME_SIZES.padding);
  const frameColor = props.brandColors.primary ?? DEFAULT_GRADIENT[0];
  const frameInset = Math.round(scaleBasis * 0.025);
  const frameThickness = Math.max(2, Math.round(scaleBasis * 0.006));
  const ctaBackground = props.brandColors.accent ?? props.brandColors.primary ?? DEFAULT_GRADIENT[0];
  const ctaTextColor = readableTextColor(ctaBackground);

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
            top: 0,
            left: 0,
            width,
            height,
            objectFit: "contain",
            opacity: 0.16,
            padding: Math.round(scaleBasis * 0.18),
          }}
        />
      )}
      <div
        style={{
          position: "absolute",
          top: frameInset,
          left: frameInset,
          width: width - frameInset * 2,
          height: height - frameInset * 2,
          display: "flex",
          border: `${frameThickness}px solid ${frameColor}`,
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width,
          display: "flex",
          flexDirection: "column",
          alignItems: props.direction === "rtl" ? "flex-end" : "flex-start",
          // Exactly MINIMALIST_FRAME_SIZES.padding, matching MINIMAL's —
          // NOT padding + frameInset. The frame is drawn as an
          // independent absolutely-positioned rect (above) rather than
          // folded into the text block's own padding, so the text's real
          // position always matches what bottomStackNearEdgeFraction
          // proved safe — padding + frameInset here would silently move
          // the headline's near edge higher than the quality gate checked.
          padding,
          gap: Math.round(scaleBasis * 0.02),
          direction: props.direction,
        }}
      >
        <div style={{ display: "flex", fontSize: Math.round(scaleBasis * MINIMALIST_FRAME_SIZES.headlineFontSize), fontWeight: 700, color: "#ffffff", lineHeight: 1.15, textAlign: props.textAlign }}>
          {props.headline}
        </div>
        {props.subhead && (
          <div style={{ display: "flex", fontSize: Math.round(scaleBasis * MINIMALIST_FRAME_SIZES.subheadFontSize), fontWeight: 400, color: "rgba(255,255,255,0.92)", lineHeight: 1.3, textAlign: props.textAlign }}>
            {props.subhead}
          </div>
        )}
        {props.cta && (
          <div
            style={{
              display: "flex",
              marginTop: Math.round(scaleBasis * 0.01),
              padding: `${Math.round(scaleBasis * MINIMALIST_FRAME_SIZES.ctaVerticalPadding)}px ${Math.round(scaleBasis * 0.028)}px`,
              borderRadius: Math.round(scaleBasis * 0.4),
              background: ctaBackground,
              color: ctaTextColor,
              fontSize: Math.round(scaleBasis * MINIMALIST_FRAME_SIZES.ctaFontSize),
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

// ---------- INFOGRAPHIC_SHOWCASE ----------
// A real step up in layout sophistication from the other 7 templates
// (2026-09-03): icon-based benefit callouts, an organic curved photo/
// text divide, a company-name banner, a real contact row, a trust-badge
// row, and a decorative border. Feasibility was verified empirically
// against the real installed satori (0.29.1) + resvg pipeline before
// writing any of this, not assumed:
//   - clip-path: path("<svg path data>") is genuinely supported (found
//     satori's real clip-path parser recognizing path()/polygon()/
//     circle()/ellipse()/inset() in node_modules/satori/dist/index.js)
//     — the curved divide below is a true organic curve, not an
//     approximation.
//   - A nested <svg> subtree (used for every icon here) gets embedded
//     by satori as an <image> with an image/svg+xml data URI — and
//     resvg (render.tsx's actual PNG rasterizer) genuinely rasterizes
//     that correctly, confirmed by rendering a real test icon through
//     the full satori->resvg pipeline and inspecting the output PNG.
//     Icons are built as plain {type,props} tree objects with
//     kebab-case SVG attributes (stroke-width, not strokeWidth) to
//     exactly match what that empirical test verified, rather than
//     real JSX's camelCase SVG attributes, which were never tested
//     through satori's nested-SVG embedding path.
//
// contrastSpec is "panel": every real piece of text here sits on a
// solid, fully opaque background — none of it overlays the photo
// directly. The banner uses readableTextColor(primary) directly, same
// exact-math guarantee PROMOTIONAL_BANNER/SPLIT_PRODUCT/BADGE_OFFER
// already rely on. The text-zone/contact/trust bands use a fixed light
// neutral (or a brand color mixed 85% toward white — see
// mixTowardWhite) with fixed dark text instead: mixing any color 85%
// toward white guarantees every channel >= ~217/255, which is light
// enough that dark text passes contrast regardless of the original
// brand color's own lightness — a real, checked guarantee (worst case
// is a starting channel of 0), not a readableTextColor call, but not a
// guess either. No new quality-gate mechanics needed.
//
// The optional two-column price-comparison box described in the
// reference is deliberately never rendered here: there is no real
// pricing/tier data source anywhere in this app today (confirmed by
// reading the schema before building this), and CLAUDE.md's own rule
// is "never fake it" — this degrades cleanly (the box is simply absent)
// rather than showing empty/invented placeholders, exactly what the
// task's own verification asked for.
interface SatoriNode {
  type: string;
  props: Record<string, unknown>;
}

function svgEl(type: string, props: Record<string, unknown>, children?: SatoriNode[]): SatoriNode {
  return { type, props: children ? { ...props, children } : props };
}

type InfographicIconKind = "check" | "star" | "shield" | "leaf" | "phone" | "chat" | "mail" | "globe";

function infographicIcon(kind: InfographicIconKind, size: number, color: string): SatoriNode {
  const common = { width: size, height: size, viewBox: "0 0 24 24" };
  switch (kind) {
    case "check":
      return svgEl("svg", common, [
        svgEl("circle", { cx: 12, cy: 12, r: 10, fill: "none", stroke: color, "stroke-width": 2 }),
        svgEl("path", { d: "M7.5 12.5 L10.5 15.5 L16.5 9", fill: "none", stroke: color, "stroke-width": 2 }),
      ]);
    case "star":
      return svgEl("svg", common, [
        svgEl("path", {
          d: "M12 2 L14.7 9 L22 9.5 L16.5 14.3 L18.2 21.5 L12 17.6 L5.8 21.5 L7.5 14.3 L2 9.5 L9.3 9 Z",
          fill: color,
        }),
      ]);
    case "shield":
      return svgEl("svg", common, [
        svgEl("path", {
          d: "M12 2 L20 5.5 L20 11 C20 16 16.5 20 12 22 C7.5 20 4 16 4 11 L4 5.5 Z",
          fill: "none",
          stroke: color,
          "stroke-width": 2,
        }),
        svgEl("path", { d: "M8.5 12 L11 14.5 L15.5 9.5", fill: "none", stroke: color, "stroke-width": 2 }),
      ]);
    case "leaf":
      return svgEl("svg", common, [
        svgEl("path", { d: "M4 20 C4 10 12 3 21 3 C21 12 14 20 4 20 Z", fill: color }),
      ]);
    case "phone":
      return svgEl("svg", common, [
        svgEl("path", {
          d: "M6 3 L9.5 3 L11 7 L8.8 8.6 C9.7 11.2 12.6 14.1 15.2 15 L16.8 12.8 L21 14.3 L21 17.8 C21 19.2 19.7 20.3 18.3 20 C10.9 18.6 5.6 13.3 4.2 5.9 C3.9 4.5 5 3 6 3 Z",
          fill: color,
        }),
      ]);
    case "chat":
      return svgEl("svg", common, [
        svgEl("path", {
          d: "M4 5 H20 C21.1 5 22 5.9 22 7 V15 C22 16.1 21.1 17 20 17 H9 L4 21 V17 C2.9 17 2 16.1 2 15 V7 C2 5.9 2.9 5 4 5 Z",
          fill: color,
        }),
      ]);
    case "mail":
      return svgEl("svg", common, [
        svgEl("rect", { x: 3, y: 5, width: 18, height: 14, rx: 2, fill: "none", stroke: color, "stroke-width": 2 }),
        svgEl("path", { d: "M3.5 6.5 L12 13 L20.5 6.5", fill: "none", stroke: color, "stroke-width": 2 }),
      ]);
    case "globe":
      return svgEl("svg", common, [
        svgEl("circle", { cx: 12, cy: 12, r: 9, fill: "none", stroke: color, "stroke-width": 2 }),
        svgEl("ellipse", { cx: 12, cy: 12, rx: 4, ry: 9, fill: "none", stroke: color, "stroke-width": 1.5 }),
        svgEl("path", { d: "M3 12 H21 M4.5 7 H19.5 M4.5 17 H19.5", fill: "none", stroke: color, "stroke-width": 1.5 }),
      ]);
  }
}

const BENEFIT_ICON_ROTATION: InfographicIconKind[] = ["check", "star", "shield", "leaf"];

function renderInfographicShowcase(props: TemplateRenderProps): ReactElement {
  const { width, height } = props;
  const scaleBasis = Math.min(width, height);
  const isRtl = props.direction === "rtl";
  const padding = Math.round(scaleBasis * 0.055);

  const primary = props.brandColors.primary ?? DEFAULT_GRADIENT[0];
  const secondary = props.brandColors.secondary ?? DEFAULT_GRADIENT[1];
  const accent = props.brandColors.accent ?? primary;
  // panelBg is a fixed light neutral, always paired with dark text —
  // readableTextColor isn't needed here the way it is for brand-color
  // bands below, since this isn't derived from an arbitrary brand color.
  const panelBg = "#faf9f6";
  const panelText = "#1a1a1a";
  const bannerText = readableTextColor(primary);
  const contactBandBg = mixTowardWhite(secondary, 0.85);
  const contactText = "#1a1a1a";

  // Organic curved photo/text divide — a real clip-path: path(), not an
  // approximation (see this template's own top comment). photoBoxHeight
  // is deliberately taller than the visible photo region so the curve's
  // downward dip never exposes empty space beneath the clipped shape.
  const photoVisibleHeight = Math.round(height * 0.33);
  const curveAmplitude = Math.round(height * 0.03);
  const photoBoxHeight = photoVisibleHeight + curveAmplitude;
  const curvePath = `M0,0 L${width},0 L${width},${photoVisibleHeight} C${Math.round(width * 0.68)},${photoVisibleHeight + curveAmplitude} ${Math.round(width * 0.32)},${photoVisibleHeight - curveAmplitude} 0,${photoVisibleHeight} Z`;

  const benefits = (props.benefits ?? []).slice(0, 4);
  const trustBadges = (props.trustBadges ?? []).slice(0, 3);
  const contact = props.contact;
  const contactRows: { kind: InfographicIconKind; label: string }[] = [];
  if (contact?.phone) contactRows.push({ kind: "phone", label: contact.phone });
  if (contact?.whatsapp) contactRows.push({ kind: "chat", label: contact.whatsapp });
  if (contact?.email) contactRows.push({ kind: "mail", label: contact.email });
  if (contact?.website) contactRows.push({ kind: "globe", label: contact.website.replace(/^https?:\/\//, "") });

  const iconSize = Math.round(scaleBasis * 0.032);

  return (
    <div style={{ width, height, display: "flex", flexDirection: "column", position: "relative", fontFamily: props.fontFamily, background: panelBg }}>
      {/* Photo zone with organic curved bottom edge */}
      <div style={{ display: "flex", position: "relative", width, height: photoBoxHeight }}>
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: 0,
            left: 0,
            width,
            height: photoBoxHeight,
            clipPath: `path('${curvePath}')`,
          }}
        >
          <img src={props.backgroundDataUri} alt="" style={{ width, height: photoBoxHeight, objectFit: "cover" }} />
        </div>
        {props.logoDataUri && (
          <div
            style={{
              display: "flex",
              position: "absolute",
              top: Math.round(padding * 0.7),
              ...(isRtl ? { right: Math.round(padding * 0.7) } : { left: Math.round(padding * 0.7) }),
              width: Math.round(scaleBasis * 0.14),
              height: Math.round(scaleBasis * 0.14),
              borderRadius: "50%",
              background: "#ffffff",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
            }}
          >
            <img
              src={props.logoDataUri}
              alt=""
              style={{ width: "76%", height: "76%", objectFit: "contain", borderRadius: "50%" }}
            />
          </div>
        )}
      </div>

      {/* Text zone: product name + tagline + benefit rows. overflow:
          hidden is a real defensive clip (satori supports it, per its
          own README's overflow row) — a real bug was found live where
          this zone's natural content height exceeded its available
          space and visually bled into the banner below; sizes were
          re-tuned to fit, and this stays as a backstop against an
          unusually long real headline/benefit text doing the same. */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width,
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
          padding: `${Math.round(scaleBasis * 0.02)}px ${padding}px`,
          gap: Math.round(scaleBasis * 0.014),
          direction: props.direction,
        }}
      >
        <div
          style={{
            display: "block",
            fontSize: Math.round(scaleBasis * 0.044),
            fontWeight: 800,
            color: panelText,
            lineHeight: 1.15,
            textAlign: props.textAlign,
            lineClamp: 2,
          }}
        >
          {props.headline}
        </div>
        {props.subhead && (
          <div
            style={{
              display: "block",
              fontSize: Math.round(scaleBasis * 0.022),
              fontWeight: 400,
              color: primary,
              lineHeight: 1.3,
              textAlign: props.textAlign,
              lineClamp: 1,
            }}
          >
            {props.subhead}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: Math.round(scaleBasis * 0.015), marginTop: Math.round(scaleBasis * 0.012) }}>
          {benefits.map((benefit, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                flexDirection: isRtl ? "row-reverse" : "row",
                alignItems: "center",
                gap: Math.round(scaleBasis * 0.018),
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: Math.round(iconSize * 1.7),
                  height: Math.round(iconSize * 1.7),
                  borderRadius: "50%",
                  background: mixTowardWhite(accent, 0.85),
                  flexShrink: 0,
                }}
              >
                {infographicIcon(BENEFIT_ICON_ROTATION[i % BENEFIT_ICON_ROTATION.length], iconSize, accent) as unknown as ReactElement}
              </div>
              <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                <div style={{ display: "block", fontSize: Math.round(scaleBasis * 0.02), fontWeight: 700, color: panelText, textAlign: props.textAlign, lineClamp: 1 }}>
                  {benefit.headline}
                </div>
                <div style={{ display: "block", fontSize: Math.round(scaleBasis * 0.015), fontWeight: 400, color: "#555555", textAlign: props.textAlign, lineClamp: 1 }}>
                  {benefit.subtext}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Full-width company-name banner */}
      <div
        style={{
          display: "flex",
          width,
          justifyContent: "center",
          alignItems: "center",
          background: primary,
          padding: `${Math.round(scaleBasis * 0.014)}px ${padding}px`,
        }}
      >
        <div style={{ display: "flex", fontSize: Math.round(scaleBasis * 0.026), fontWeight: 800, color: bannerText, letterSpacing: Math.round(scaleBasis * 0.002), textAlign: "center" }}>
          {props.companyName}
        </div>
      </div>

      {/* Contact row — only real, set fields; never a placeholder */}
      {contactRows.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            width,
            justifyContent: "center",
            alignItems: "center",
            background: contactBandBg,
            padding: `${Math.round(scaleBasis * 0.01)}px ${padding}px`,
            gap: Math.round(scaleBasis * 0.024),
            direction: props.direction,
          }}
        >
          {contactRows.map((row, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: Math.round(scaleBasis * 0.008) }}>
              {infographicIcon(row.kind, Math.round(iconSize * 0.85), primary) as unknown as ReactElement}
              <div style={{ display: "flex", fontSize: Math.round(scaleBasis * 0.014), fontWeight: 500, color: contactText }}>{row.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Trust badge row */}
      {trustBadges.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            width,
            justifyContent: "center",
            alignItems: "center",
            background: panelBg,
            padding: `${Math.round(scaleBasis * 0.008)}px ${padding}px`,
            gap: Math.round(scaleBasis * 0.024),
            direction: props.direction,
          }}
        >
          {trustBadges.map((badge, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: Math.round(scaleBasis * 0.006) }}>
              {infographicIcon("shield", Math.round(iconSize * 0.75), secondary) as unknown as ReactElement}
              <div style={{ display: "flex", fontSize: Math.round(scaleBasis * 0.013), fontWeight: 600, color: "#444444" }}>{badge}</div>
            </div>
          ))}
        </div>
      )}

      {/* Decorative bottom border — small alternating diamonds, plain
          divs (not SVG) to match this file's existing decorative-
          element convention (MODERN_BANNER's accent bar, MINIMALIST_
          FRAME's border). */}
      <div style={{ display: "flex", width, height: Math.round(scaleBasis * 0.014), background: primary, alignItems: "center", justifyContent: "space-around" }}>
        {Array.from({ length: 14 }).map((_, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              width: Math.round(scaleBasis * 0.009),
              height: Math.round(scaleBasis * 0.009),
              background: i % 2 === 0 ? accent : "#ffffff",
              transform: "rotate(45deg)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

function mixTowardWhite(hex: string, t: number): string {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const num = parseInt(full, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  const mix = (c: number) => Math.round(c + (255 - c) * t);
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`;
}

export const POSTER_TEMPLATES: Record<PosterTemplate, PosterTemplateDefinition> = {
  MINIMAL: {
    id: "MINIMAL",
    name: "Minimal",
    description: "Clean full-bleed photo with understated bottom text — quiet and versatile.",
    contrastSpec: {
      kind: "overlay",
      scrimStops: MINIMAL_SCRIM,
      headlineNearEdgeFraction: (ar) => bottomStackNearEdgeFraction(ar, MINIMAL_SIZES),
      headlineDensity: { fontSizeFraction: MINIMAL_SIZES.headlineFontSize, maxLines: 3 },
    },
    render: renderMinimal,
  },
  BOLD_HEADLINE: {
    id: "BOLD_HEADLINE",
    name: "Bold Headline",
    description: "Large, confident type over a consistently darkened photo — for a strong single message.",
    contrastSpec: {
      kind: "overlay",
      scrimStops: BOLD_SCRIM,
      headlineNearEdgeFraction: (ar) => bottomStackNearEdgeFraction(ar, BOLD_SIZES),
      headlineDensity: { fontSizeFraction: BOLD_SIZES.headlineFontSize, maxLines: 3 },
    },
    render: renderBoldHeadline,
  },
  PROMOTIONAL_BANNER: {
    id: "PROMOTIONAL_BANNER",
    name: "Promotional Banner",
    description: "Photo up top, a solid brand-color banner for the message below — maximum readability.",
    contrastSpec: { kind: "panel", headlineDensity: { fontSizeFraction: 0.06, maxLines: 3 } },
    render: renderPromotionalBanner,
  },
  SPLIT_PRODUCT: {
    id: "SPLIT_PRODUCT",
    name: "Split Product View",
    description: "Photo and a solid brand panel side by side — logo, message, and CTA together in the panel.",
    contrastSpec: { kind: "panel", headlineDensity: { fontSizeFraction: 0.055, maxLines: 3 } },
    render: renderSplitProduct,
  },
  MODERN_BANNER: {
    id: "MODERN_BANNER",
    name: "Modern Banner",
    description: "Bottom gradient over the photo with a brand-color accent bar beside the text — clean and current.",
    contrastSpec: {
      kind: "overlay",
      scrimStops: MODERN_BANNER_SCRIM,
      headlineNearEdgeFraction: (ar) => bottomStackNearEdgeFraction(ar, MODERN_BANNER_SIZES),
      headlineDensity: { fontSizeFraction: MODERN_BANNER_SIZES.headlineFontSize, maxLines: 3 },
    },
    render: renderModernBanner,
  },
  BADGE_OFFER: {
    id: "BADGE_OFFER",
    name: "Badge & Offer",
    description: "A centered, high-contrast accent-color card holds the whole message — built for a sale or offer.",
    contrastSpec: { kind: "panel", headlineDensity: { fontSizeFraction: 0.065, maxLines: 3 } },
    render: renderBadgeOffer,
  },
  MINIMALIST_FRAME: {
    id: "MINIMALIST_FRAME",
    name: "Minimalist Frame",
    description: "Clean bottom text on a full photo, with a thin brand-color border frame and a subtle logo watermark.",
    contrastSpec: {
      kind: "overlay",
      scrimStops: MINIMALIST_FRAME_SCRIM,
      headlineNearEdgeFraction: (ar) => bottomStackNearEdgeFraction(ar, MINIMALIST_FRAME_SIZES),
      headlineDensity: { fontSizeFraction: MINIMALIST_FRAME_SIZES.headlineFontSize, maxLines: 3 },
    },
    render: renderMinimalistFrame,
  },
  INFOGRAPHIC_SHOWCASE: {
    id: "INFOGRAPHIC_SHOWCASE",
    name: "Infographic Showcase",
    description: "A structured, icon-driven layout with benefit callouts, contact info, and trust badges — for a detailed product or service showcase.",
    // maxLines: 2, matching this template's own real lineClamp: 2 on the
    // headline (see renderInfographicShowcase) — not a soft target like
    // the other panel templates, a real hard render-time cap.
    contrastSpec: { kind: "panel", headlineDensity: { fontSizeFraction: 0.044, maxLines: 2 } },
    render: renderInfographicShowcase,
  },
};

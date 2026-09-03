import type { AspectRatio } from "@prisma/client";

import { POSTER_DIMENSIONS } from "./dimensions";
import { contrastRatio } from "./contrast";
import { isArabicScript } from "./direction";

export interface QualityGateInput {
  headline: string;
  companyLocale: "EN" | "AR";
  aspectRatio: AspectRatio;
  contrastSpec: TemplateContrastSpec;
}

export interface QualityGateIssue {
  code: string;
  severity: "fail" | "warning";
  message: string;
}

export interface QualityGateResult {
  passed: boolean;
  issues: QualityGateIssue[];
}

// [heightFraction, alpha] pairs along a "to top" gradient measured from
// the scrim's zero-reference edge (matches the CSS "to top" convention
// already used in templates.tsx) — a template's contrast guarantee is
// only as real as this matching its actual rendered scrim exactly.
export type ScrimStops = ReadonlyArray<readonly [number, number]>;

// Text composited over the photo/gradient background behind a
// translucent scrim — contrast depends on how dark the underlying photo
// could be, so it's proven against the worst case (a pure white photo).
export interface OverlayContrastSpec {
  kind: "overlay";
  scrimStops: ScrimStops;
  // Fraction of height (from the scrim's zero-reference edge) where the
  // headline's near edge can land in the worst case (most wrapped
  // lines) — must mirror the template's real proportional sizing.
  headlineNearEdgeFraction: (aspectRatio: AspectRatio) => number;
  headlineDensity: HeadlineDensitySpec;
}

// Text sits on a solid, fully-known color (a panel, not a photo) —
// contrast is exact math, not a worst-case estimate, and paired with
// readableTextColor() at render time it's mathematically guaranteed
// >=4.58:1 (the provable minimum of max(contrast-vs-white,
// contrast-vs-black) across every possible color) regardless of which
// brand color the panel ends up being — comfortably above the 3:1 large
// text minimum this gate enforces, so no aspect-ratio-specific
// computation is needed at all.
export interface PanelContrastSpec {
  kind: "panel";
  headlineDensity: HeadlineDensitySpec;
}

export type TemplateContrastSpec = OverlayContrastSpec | PanelContrastSpec;

// Real per-template facts (not duplicated magic numbers — each
// template's own real headlineFontSize fraction, already the single
// source of truth templates.tsx renders from) feeding the density
// check below. maxLines is the same real assumption each template's
// own layout already makes: the bottom-stack overlay templates'
// contrast math hardcodes 3 wrapped headline lines
// (bottomStackNearEdgeFraction), INFOGRAPHIC_SHOWCASE hard-clips at 2
// (its own real lineClamp:2) — panel templates auto-grow instead of
// hard-capping, so their number here is a real "still looks good"
// target, not a hard render-time limit.
export interface HeadlineDensitySpec {
  fontSizeFraction: number;
  maxLines: number;
}

// Real, honest heuristic — a genuine average glyph width for this app's
// bundled bold sans-serif fonts (Lato/Tajawal) at a given font size, not
// exact text-layout math (that needs real font metrics this gate has no
// access to pre-render). Same "labeled approximate, not fake precision"
// convention as detectToneHeuristic (template-provider.ts). Used to
// estimate whether a real headline would wrap past the number of lines
// the chosen template's own layout already assumes — the same real risk
// class the contrast gate's own worst-case math already worries about,
// since a headline that wraps further than assumed can push contrast-
// critical text lower than the proven-safe zone, or (panel templates)
// squeeze the photo toward zero height.
const AVG_CHAR_WIDTH_RATIO = 0.56;
const HEADLINE_WIDTH_FRACTION = 0.86; // ~1 - 2x each template's own real side padding

function estimateMaxHeadlineChars(aspectRatio: AspectRatio, density: HeadlineDensitySpec): number {
  const { width } = POSTER_DIMENSIONS[aspectRatio];
  const scaleBasis = scaleBasisFor(aspectRatio);
  const fontSizePx = scaleBasis * density.fontSizeFraction;
  const avgCharWidthPx = Math.max(1, fontSizePx * AVG_CHAR_WIDTH_RATIO);
  const usableWidthPx = width * HEADLINE_WIDTH_FRACTION;
  const charsPerLine = Math.max(4, Math.floor(usableWidthPx / avgCharWidthPx));
  return charsPerLine * density.maxLines;
}

function scrimAlphaAt(stops: ScrimStops, heightFraction: number): number {
  const clamped = Math.min(Math.max(heightFraction, 0), 1);
  for (let i = 0; i < stops.length - 1; i += 1) {
    const [f0, a0] = stops[i];
    const [f1, a1] = stops[i + 1];
    if (clamped >= f0 && clamped <= f1) {
      const t = (clamped - f0) / (f1 - f0);
      return a0 + (a1 - a0) * t;
    }
  }
  return 0;
}

// Worst-case (highest-luminance-possible) background is a pure white
// photo — any real photo is darker, so if contrast passes against
// white it passes against anything. A mathematical guarantee derived
// from the scrim design, not a sample of one rendered image.
function worstCaseOverlayContrast(spec: OverlayContrastSpec, aspectRatio: AspectRatio): number {
  const fraction = spec.headlineNearEdgeFraction(aspectRatio);
  const alpha = scrimAlphaAt(spec.scrimStops, fraction);
  const composited = 255 * (1 - alpha); // black scrim over white photo, per channel
  const grayHex = `#${Math.round(composited).toString(16).padStart(2, "0").repeat(3)}`;
  return contrastRatio("#ffffff", grayHex);
}

// WCAG AA large-text minimum. Every template's headline is well above
// the 24px/18.66px-bold large-text threshold at every supported aspect
// ratio, so 3:1 — not the stricter 4.5:1 for normal text — is the
// correct bar here.
const MIN_HEADLINE_CONTRAST = 3;

export function runPosterQualityGate(input: QualityGateInput): QualityGateResult {
  const issues: QualityGateIssue[] = [];

  const contrast =
    input.contrastSpec.kind === "panel"
      ? Infinity // proven >=4.58:1 by construction — see PanelContrastSpec doc above
      : worstCaseOverlayContrast(input.contrastSpec, input.aspectRatio);

  if (contrast < MIN_HEADLINE_CONTRAST) {
    issues.push({
      code: "contrast",
      severity: "fail",
      message: `Worst-case headline contrast (${contrast.toFixed(2)}:1) for this format falls below the ${MIN_HEADLINE_CONTRAST}:1 WCAG minimum for large text.`,
    });
  }

  // Real whitespace/density check (research-backed design principle
  // #4, 2026-09-03): an unusually long headline for the chosen template
  // is a genuine, measurable overcrowding risk — either it wraps past
  // the number of lines the template's own contrast math assumed
  // (overlay templates), or it forces a panel template's photo toward
  // zero height to make room. A warning, not a fail — a slightly-long
  // headline still renders (clipped or auto-grown), just not at its
  // best; this is a real, honest heuristic estimate, not exact
  // wrapping math (see estimateMaxHeadlineChars's own doc comment).
  const maxHeadlineChars = estimateMaxHeadlineChars(input.aspectRatio, input.contrastSpec.headlineDensity);
  if (input.headline.length > maxHeadlineChars) {
    issues.push({
      code: "headline-density",
      severity: "warning",
      message: `This headline (${input.headline.length} characters) is longer than this template/format comfortably fits (~${maxHeadlineChars} characters) — it may wrap more than intended or crowd the rest of the layout. Consider a shorter headline or a template with more room.`,
    });
  }

  const headlineIsArabic = isArabicScript(input.headline);
  if (input.companyLocale === "AR" && !headlineIsArabic) {
    issues.push({
      code: "locale-mismatch",
      severity: "warning",
      message: "Company locale is Arabic but the headline doesn't contain Arabic text.",
    });
  }
  if (input.companyLocale === "EN" && headlineIsArabic) {
    issues.push({
      code: "locale-mismatch",
      severity: "warning",
      message: "Headline contains Arabic text but the company locale is set to English.",
    });
  }

  // Not implemented: a real spelling gate needs a dictionary and
  // language-aware tokenization (doubly so for Arabic). Faking a check
  // that always passes would violate CLAUDE.md's "no fake
  // functionality" rule worse than omitting it — this is a documented
  // gap, not a silent one. See README.md's Phase 3 status.

  return {
    passed: !issues.some((issue) => issue.severity === "fail"),
    issues,
  };
}

// Shared by templates.tsx (to build the actual render) and this file's
// tests/callers — keeps the aspect-ratio-proportional sizing constants
// in exactly one place so render and gate can never drift apart.
export function scaleBasisFor(aspectRatio: AspectRatio): number {
  const { width, height } = POSTER_DIMENSIONS[aspectRatio];
  return Math.min(width, height);
}

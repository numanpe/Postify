import type { AspectRatio } from "@prisma/client";

import { POSTER_DIMENSIONS } from "./dimensions";
import { contrastRatio } from "./contrast";
import { isArabicScript } from "./direction";

export interface QualityGateInput {
  headline: string;
  companyLocale: "EN" | "AR";
  aspectRatio: AspectRatio;
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

// Must match the scrim gradient in render.tsx exactly: "linear-gradient(
// to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.55) 42%, rgba(0,0,0,0) 75%)".
// Stops are fractions of height measured from the bottom edge (CSS "to
// top" starts the gradient at the bottom).
const SCRIM_STOPS: ReadonlyArray<readonly [number, number]> = [
  [0, 0.88],
  [0.42, 0.55],
  [0.75, 0],
  [1, 0],
];

function scrimAlphaAt(heightFraction: number): number {
  const clamped = Math.min(heightFraction, 1);
  for (let i = 0; i < SCRIM_STOPS.length - 1; i += 1) {
    const [f0, a0] = SCRIM_STOPS[i];
    const [f1, a1] = SCRIM_STOPS[i + 1];
    if (clamped >= f0 && clamped <= f1) {
      const t = (clamped - f0) / (f1 - f0);
      return a0 + (a1 - a0) * t;
    }
  }
  return 0;
}

// Worst-case (highest-luminance-possible) background is a pure white
// photo — any real photo is darker, so if contrast passes against
// white it passes against anything. This is a mathematical guarantee
// derived from the known scrim design, not a sample of one rendered
// image, so it holds for every poster the pipeline produces.
function worstCaseContrastAt(heightFraction: number): number {
  const alpha = scrimAlphaAt(heightFraction);
  const composited = 255 * (1 - alpha); // black scrim over white photo, per channel
  const grayHex = `#${Math.round(composited).toString(16).padStart(2, "0").repeat(3)}`;
  return contrastRatio("#ffffff", grayHex);
}

// Mirrors render.tsx's proportional sizing exactly (scaleBasis =
// min(width, height), same 0.065/0.03/0.024/0.06/0.02/0.014 constants)
// so this is a real prediction of where the headline's top edge can
// land, not a guessed fraction. Assumes a conservative worst case: 3
// wrapped headline lines, 2 wrapped subhead lines, and a CTA badge, all
// present at once — real posts are usually shorter than this.
function headlineTopFraction(aspectRatio: AspectRatio): number {
  const { width, height } = POSTER_DIMENSIONS[aspectRatio];
  const scaleBasis = Math.min(width, height);

  const headlineFontSize = scaleBasis * 0.065;
  const subheadFontSize = scaleBasis * 0.03;
  const ctaFontSize = scaleBasis * 0.024;
  const padding = scaleBasis * 0.06;
  const gap = scaleBasis * 0.02;
  const ctaVerticalPadding = scaleBasis * 0.014;

  const headlineBlock = headlineFontSize * 1.15 * 3;
  const subheadBlock = subheadFontSize * 1.3 * 2;
  const ctaBlock = ctaFontSize + 2 * ctaVerticalPadding;

  const totalPx = padding + headlineBlock + gap + subheadBlock + gap + ctaBlock;
  return totalPx / height;
}

// WCAG AA large-text minimum. The headline is always well above the
// 24px/18.66px-bold large-text threshold at every supported aspect
// ratio (smallest headline size is ~70px on a 1080-basis canvas), so
// 3:1 — not the stricter 4.5:1 for normal text — is the correct bar
// here. Subhead/CTA sit strictly below the headline in the stack
// (more scrim coverage, so higher contrast) or have their own
// construction-time contrast guarantee (CTA badge text color, see
// readableTextColor in contrast.ts), so the headline position is the
// binding constraint.
const MIN_HEADLINE_CONTRAST = 3;

export function runPosterQualityGate(input: QualityGateInput): QualityGateResult {
  const issues: QualityGateIssue[] = [];

  const fraction = headlineTopFraction(input.aspectRatio);
  const contrast = worstCaseContrastAt(fraction);
  if (contrast < MIN_HEADLINE_CONTRAST) {
    issues.push({
      code: "contrast",
      severity: "fail",
      message: `Worst-case headline contrast (${contrast.toFixed(2)}:1) for this format falls below the ${MIN_HEADLINE_CONTRAST}:1 WCAG minimum for large text.`,
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

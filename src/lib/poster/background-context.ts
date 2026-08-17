import type { BrandKit, MediaAsset, PosterTemplate } from "@prisma/client";

import type { CompanyContext } from "@/lib/company-context";
import { INDUSTRY_PACKS } from "@/lib/industry-packs";
import { detectDirection } from "./direction";
import { readableTextColor } from "./contrast";
import { POSTER_TEMPLATES } from "./templates";
import { DEFAULT_GRADIENT } from "@/lib/providers/image/gradient-provider";

export interface BackgroundGeneratorContext {
  industry: string;
  visualTone: string;
  accentColorsForBackground: string[];
  forbiddenStyles: string[];
  layoutDirection: "LTR" | "RTL";
}

export interface HtmlSvgTemplateContext {
  brandName: string;
  // Real bytes-based data URI, not a fetchable URL — this app's brand
  // logos live in private Blob storage with no public URL (see
  // storage.ts), and the existing Satori/resvg renderer already
  // consumes logos as data URIs, not by fetching a link. A literal
  // "logo_url" field would either be fake (a URL nothing can actually
  // fetch) or require standing up public asset hosting neither asked
  // for nor needed here.
  logoDataUri: string | null;
  colorPalette: {
    primaryText: string;
    accentElements: string;
    backgroundOverlay: string;
  };
  typography: {
    // The renderer's real bundled fonts (Lato/Tajawal — see
    // src/lib/fonts.ts), not BrandKit.fontHeading: that field is
    // stored but not yet wired into rendering, so reporting it here
    // would describe a font the poster won't actually use.
    fontFamily: string;
    direction: "ltr" | "rtl";
    textAlign: "left" | "right";
  };
}

export interface PosterBackgroundContext {
  backgroundGeneratorContext: BackgroundGeneratorContext;
  htmlSvgTemplateContext: HtmlSvgTemplateContext;
}

export interface BuildPosterBackgroundContextInput {
  // Real Company + CreativeDna data already fetched by the caller
  // (generate.ts) — this function shapes it into the two channels
  // rather than re-querying, so there's exactly one real DB round trip
  // behind both channels of a single poster, not two independent ones.
  context: CompanyContext;
  brandKit: (BrandKit & { logoAsset: MediaAsset | null }) | null;
  logoBuffer: Buffer | null;
  logoMimeType: string | null;
  headline: string;
  template: PosterTemplate;
}

// Stage 1 — Context Engine. Deliberately NOT an LLM call: this is real
// data retrieval and structuring, not creative generation, and the
// pipeline's own rule ("REAL DATA ONLY... never hardcode or invent")
// is best satisfied by code that can only ever reflect what's actually
// in the database, with zero hallucination risk — and it works
// identically free or BYOK, satisfying the zero-key requirement
// trivially for this stage.
export function buildPosterBackgroundContext(
  input: BuildPosterBackgroundContextInput,
): PosterBackgroundContext {
  const { context, brandKit, logoBuffer, logoMimeType, headline, template } = input;
  const pack = INDUSTRY_PACKS[context.industry];

  // Headline script, not stored locale — the same RTL policy used by
  // direction.ts/render.tsx everywhere else in the poster pipeline, so
  // the background composition and the text overlay can never disagree
  // about which way the poster reads.
  const direction = detectDirection(headline);
  const layoutDirection = direction === "rtl" ? "RTL" : "LTR";

  const accentColors = [brandKit?.primaryColor, brandKit?.secondaryColor, brandKit?.accentColor].filter(
    (color): color is string => !!color,
  );

  const primaryColor = brandKit?.primaryColor ?? DEFAULT_GRADIENT[0];

  const backgroundGeneratorContext: BackgroundGeneratorContext = {
    industry: context.industry,
    visualTone: pack.visualTone,
    accentColorsForBackground: accentColors.length > 0 ? accentColors : [...DEFAULT_GRADIENT],
    forbiddenStyles: pack.forbiddenStyles,
    layoutDirection,
  };

  // Mirrors the actual rendered scrim/panel for the chosen template
  // (see templates.tsx) rather than a generic guess — "overlay"
  // templates composite white text over a dark scrim; "panel"
  // templates put text on a solid, fully opaque brand-color block.
  const contrastKind = POSTER_TEMPLATES[template].contrastSpec.kind;
  const backgroundOverlay =
    contrastKind === "overlay" ? "rgba(0, 0, 0, 0.88)" : hexToRgba(primaryColor, 1);

  const logoDataUri = logoBuffer ? `data:${logoMimeType ?? "image/png"};base64,${logoBuffer.toString("base64")}` : null;

  const htmlSvgTemplateContext: HtmlSvgTemplateContext = {
    brandName: context.name,
    logoDataUri,
    colorPalette: {
      primaryText: readableTextColor(primaryColor),
      accentElements: brandKit?.accentColor ?? brandKit?.primaryColor ?? DEFAULT_GRADIENT[1],
      backgroundOverlay,
    },
    typography: {
      fontFamily: direction === "rtl" ? "Tajawal" : "Lato",
      direction,
      textAlign: direction === "rtl" ? "right" : "left",
    },
  };

  return { backgroundGeneratorContext, htmlSvgTemplateContext };
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

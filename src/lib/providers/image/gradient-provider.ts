import "server-only";
import sharp from "sharp";

import type { ImageProvider, GenerateBackgroundInput, GenerateBackgroundOutput } from "./types";
import { INDUSTRY_COMPOSITION_STYLE, type Industry } from "@/lib/industry-packs";

export interface GradientColors {
  primary?: string | null;
  secondary?: string | null;
  accent?: string | null;
}

// Used only when a company hasn't set brand colors yet — a neutral,
// professional-looking default rather than an empty/white background.
// Exported so templates.tsx's solid-panel templates fall back to the
// same neutral pair instead of inventing a third default.
export const DEFAULT_GRADIENT: [string, string] = ["#1f2937", "#374151"];

function escapeSvgAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

// ---------- deterministic per-poster variety ----------
// FNV-1a — a real, tiny, dependency-free string hash. Seeded from
// companyName+topic so the SAME headline for the SAME company always
// renders the same composition (reproducible, cacheable), while a
// different headline or a different company varies it — real variety
// across a company's own poster history, not the same flat gradient
// every time.
function hashSeed(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexToRgbTuple(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const num = parseInt(full, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

// Linear color mix — used to derive a real third/fourth tone (a
// lightened highlight, a darkened shadow) from the company's own actual
// brand colors, rather than reaching for an unrelated hardcoded color.
function mixHex(hexA: string, hexB: string, t: number): string {
  const [r1, g1, b1] = hexToRgbTuple(hexA);
  const [r2, g2, b2] = hexToRgbTuple(hexB);
  const mix = (a: number, b: number) => Math.round(a + (b - a) * t);
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(mix(r1, r2))}${toHex(mix(g1, g2))}${toHex(mix(b1, b2))}`;
}

// ---------- contrast safety net ----------
// Real bug found live (2026-09-03, reported against a real company's
// real poster): a BrandKit whose primary/secondary/accent are all close
// in lightness (e.g. three near-identical dark greens) makes every
// style below collapse back into what looks like a single flat
// gradient — the blobs/panels/lines are genuinely drawn, just in colors
// too close to the base wash to actually read as visible. Reproduced
// live against the real company's real colors before writing this fix.
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const [r, g, b] = hexToRgbTuple(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
  else if (max === g) h = ((b - r) / d + 2) * 60;
  else h = ((r - g) / d + 4) * 60;
  return { h, s: s * 100, l: l * 100 };
}

function hslToHex(h: number, s: number, l: number): string {
  const sN = s / 100;
  const lN = l / 100;
  const c = (1 - Math.abs(2 * lN - 1)) * sN;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lN - c / 2;
  let [r, g, b] = [0, 0, 0];
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Minimum HSL-lightness separation (percentage points) an overlay color
// needs from the base wash to actually read as a distinct design
// element once drawn at the styles' real opacities (0.3-0.55) — picked
// empirically against the real low-contrast case this was built to fix.
const MIN_DESIGN_CONTRAST_L = 22;

// Real, targeted fix: if candidateHex is already visually distinct from
// the base wash, it's returned untouched (the normal-contrast case —
// most real BrandKits — is completely unaffected by this function).
// Only when it's too close does this synthesize a same-hue variant
// pushed to a lightness that clears the threshold — still "this
// company's actual color," just a shade of it that will actually show
// up, rather than reaching for an unrelated hardcoded fallback color.
// A near-grayscale candidate (very low saturation) also gets a real
// saturation floor, since a lighter/darker gray is just as invisible
// against a colored base as a same-lightness one.
function ensureLightnessContrast(anchorL: number, candidateHex: string): string {
  const candidate = hexToHsl(candidateHex);
  if (Math.abs(anchorL - candidate.l) >= MIN_DESIGN_CONTRAST_L) return candidateHex;
  const targetL =
    anchorL >= 50
      ? Math.max(8, anchorL - MIN_DESIGN_CONTRAST_L - 6)
      : Math.min(92, anchorL + MIN_DESIGN_CONTRAST_L + 6);
  const saturation = candidate.s < 15 ? 35 : candidate.s;
  return hslToHex(candidate.h, saturation, targetL);
}

type BackgroundStyle = "MESH" | "GEOMETRIC" | "DUOTONE_TEXTURE" | "ABSTRACT_LINES";

// Reuses the same real, already-established per-industry composition
// language template-provider.ts feeds into AI background prompts
// (INDUSTRY_COMPOSITION_STYLE) — an agriculture company gets an
// "Organic" feel whether its background is this free path or a BYOK AI
// generation, not two disconnected visual languages for the same
// industry. ABSTRACT_LINES has no direct industry mapping (it's a
// neutral, industry-agnostic look) — the RNG occasionally substitutes it
// in for real variety across a company's own poster history, so the
// same industry doesn't produce the exact same style every single time.
function pickStyle(industry: Industry | undefined, rng: () => number): BackgroundStyle {
  const composition = industry ? (INDUSTRY_COMPOSITION_STYLE[industry] ?? "Minimalist") : "Minimalist";
  const primary: BackgroundStyle =
    composition === "Organic" ? "MESH" : composition === "Bold Geometric" ? "GEOMETRIC" : "DUOTONE_TEXTURE";
  return rng() < 0.25 ? "ABSTRACT_LINES" : primary;
}

interface StyleColors {
  from: string;
  to: string;
  accent: string;
  highlight: string;
  // Contrast-safe stand-in for `to` specifically where a style reuses it
  // as a FILLED OVERLAY shape (a blob/circle drawn on top of the base
  // wash) rather than as one of the base gradient's own two stops —
  // `to` itself is deliberately never altered, so the base wash always
  // stays the company's true, unmodified brand color. See
  // ensureLightnessContrast's doc comment for why this is needed.
  pop: string;
}

// ---------- style 1: MESH — soft organic blob gradient ----------
// "Organic" industries (Agriculture, Hospitality & Food): 3 large,
// heavily blurred radial blobs in brand colors over the base linear
// wash — the closest achievable real approximation of a mesh gradient
// using plain SVG (no canvas/WebGL dependency), genuinely soft and
// varied rather than one hard-edged gradient.
function buildMeshSvg(width: number, height: number, colors: StyleColors, rng: () => number): string {
  const blob = (cx: number, cy: number, r: number, color: string, opacity: number) =>
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" opacity="${opacity}" />`;
  const blobs = [
    blob(width * (0.15 + rng() * 0.25), height * (0.15 + rng() * 0.3), Math.max(width, height) * 0.42, colors.accent, 0.55),
    blob(width * (0.6 + rng() * 0.3), height * (0.55 + rng() * 0.35), Math.max(width, height) * 0.5, colors.highlight, 0.45),
    blob(width * (0.35 + rng() * 0.3), height * (0.65 + rng() * 0.25), Math.max(width, height) * 0.38, colors.pop, 0.5),
  ].join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs>
      <linearGradient id="base" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${colors.from}" />
        <stop offset="100%" stop-color="${colors.to}" />
      </linearGradient>
      <filter id="blur" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="${Math.round(Math.max(width, height) * 0.09)}" />
      </filter>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#base)" />
    <g filter="url(#blur)">${blobs}</g>
  </svg>`;
}

// ---------- style 2: GEOMETRIC — angled panel overlays ----------
// "Bold Geometric" industries (Construction & Engineering, Real Estate,
// Retail & E-commerce): base wash + 2-3 large, semi-transparent angled
// panels in accent/highlight tones, giving the "clean industrial
// lines"/"structured geometry" look those packs describe.
function buildGeometricSvg(width: number, height: number, colors: StyleColors, rng: () => number): string {
  const diag = Math.max(width, height) * 1.6;
  // Real bug found live (2026-09-03): the original ranges here only
  // varied the panel ANGLE by a few degrees, with fixed anchor points —
  // different seeds produced visually near-identical compositions
  // (confirmed by generating two real posters for the same company).
  // Panel anchor X/Y, width, and which brand color lands on which panel
  // all vary now, so different headlines for the same company produce
  // genuinely distinct layouts, not just a slightly different tilt.
  const angle1 = -25 - rng() * 20;
  const angle2 = 8 + rng() * 20;
  const panel1X = width * (0.35 + rng() * 0.35);
  const panel1Width = diag * (0.2 + rng() * 0.18);
  const panel1Pivot = { x: width * (0.6 + rng() * 0.3), y: height * (0.1 + rng() * 0.3) };
  const panel2X = -diag * (0.05 + rng() * 0.15);
  const panel2Width = diag * (0.16 + rng() * 0.16);
  const panel2Pivot = { x: width * (0.1 + rng() * 0.25), y: height * (0.65 + rng() * 0.25) };
  const [panelColorA, panelColorB] = rng() < 0.5 ? [colors.accent, colors.highlight] : [colors.highlight, colors.accent];
  const circleR = Math.max(width, height) * (0.12 + rng() * 0.1);
  const circleSide = rng() < 0.5;
  const panels = `
    <g transform="rotate(${angle1} ${panel1Pivot.x} ${panel1Pivot.y})">
      <rect x="${panel1X}" y="${-diag * 0.3}" width="${panel1Width}" height="${diag}" fill="${panelColorA}" opacity="0.5" />
    </g>
    <g transform="rotate(${angle2} ${panel2Pivot.x} ${panel2Pivot.y})">
      <rect x="${panel2X}" y="${height * 0.5}" width="${panel2Width}" height="${diag}" fill="${panelColorB}" opacity="0.4" />
    </g>
    <circle cx="${width * (circleSide ? 0.78 + rng() * 0.14 : 0.08 + rng() * 0.14)}" cy="${height * (0.72 + rng() * 0.2)}" r="${circleR}" fill="${colors.pop}" opacity="0.35" />
  `;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs>
      <linearGradient id="base" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${colors.from}" />
        <stop offset="100%" stop-color="${colors.to}" />
      </linearGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#base)" />
    ${panels}
  </svg>`;
}

// ---------- style 3: DUOTONE_TEXTURE — clean duotone + subtle grain ----------
// "Minimalist" industries (Education, Healthcare, Professional
// Services): a clean two-stop duotone wash with a real, subtle SVG-noise
// grain overlay (feTurbulence + feColorMatrix to grayscale, low opacity)
// for depth — no flat single-gradient look, without introducing any
// busy shapes for industries whose own visualTone explicitly calls for
// calm/clean/muted.
function buildDuotoneTextureSvg(width: number, height: number, colors: StyleColors, rng: () => number): string {
  const seedAttr = Math.round(rng() * 100);
  // Real bug found live (2026-09-03): a fixed 0%->55%->100% top-left to
  // bottom-right diagonal made every generation for a company look
  // near-identical regardless of headline (confirmed by generating two
  // real posters) — only the imperceptible grain seed varied. The
  // gradient's direction and highlight-stop position now vary too, a
  // real structural difference, not just noise.
  const directions = [
    { x1: 0, y1: 0, x2: 100, y2: 100 },
    { x1: 100, y1: 0, x2: 0, y2: 100 },
    { x1: 0, y1: 100, x2: 100, y2: 0 },
    { x1: 20, y1: 0, x2: 80, y2: 100 },
  ];
  const dir = directions[Math.floor(rng() * directions.length)];
  const midStop = Math.round(35 + rng() * 30);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs>
      <linearGradient id="base" x1="${dir.x1}%" y1="${dir.y1}%" x2="${dir.x2}%" y2="${dir.y2}%">
        <stop offset="0%" stop-color="${colors.from}" />
        <stop offset="${midStop}%" stop-color="${colors.accent}" />
        <stop offset="100%" stop-color="${colors.to}" />
      </linearGradient>
      <filter id="grain">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="${seedAttr}" result="noise" />
        <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.09 0" />
      </filter>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#base)" />
    <rect width="${width}" height="${height}" filter="url(#grain)" />
  </svg>`;
}

// ---------- style 4: ABSTRACT_LINES — neutral diagonal line pattern ----------
// Industry-agnostic alternate (see pickStyle's own doc comment): a base
// wash with a tiled, low-opacity diagonal-line pattern in the accent
// color — reads as "clean, current," not tied to any one industry's
// visual language, used for real variety across a company's own poster
// history.
function buildAbstractLinesSvg(width: number, height: number, colors: StyleColors, rng: () => number): string {
  const spacing = Math.round(Math.max(width, height) * (0.045 + rng() * 0.02));
  const angle = rng() < 0.5 ? 45 : -45;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs>
      <linearGradient id="base" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${colors.from}" />
        <stop offset="100%" stop-color="${colors.to}" />
      </linearGradient>
      <pattern id="lines" width="${spacing}" height="${spacing}" patternUnits="userSpaceOnUse" patternTransform="rotate(${angle})">
        <line x1="0" y1="0" x2="0" y2="${spacing}" stroke="${colors.accent}" stroke-width="${Math.max(1, Math.round(spacing * 0.06))}" opacity="0.3" />
      </pattern>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#base)" />
    <rect width="${width}" height="${height}" fill="url(#lines)" />
  </svg>`;
}

const STYLE_BUILDERS: Record<BackgroundStyle, typeof buildMeshSvg> = {
  MESH: buildMeshSvg,
  GEOMETRIC: buildGeometricSvg,
  DUOTONE_TEXTURE: buildDuotoneTextureSvg,
  ABSTRACT_LINES: buildAbstractLinesSvg,
};

// The zero-key free path for poster backgrounds — real, varied design
// compositions built entirely from the company's own actual brand
// colors, no external call, never fails or rate-limits. Replaces the
// original flat 2-stop linear gradient (2026-09-03): that version is
// what most real posters actually shipped with, since AI backgrounds are
// an explicit per-campaign opt-in — this is the modernization of that
// zero-cost default itself, not a change to the opt-in decision. This is
// the poster-engine equivalent of Phase 2's TemplateTextProvider.
export class GradientBackgroundProvider implements ImageProvider {
  readonly name = "Free (brand gradient)";

  constructor(private readonly colors: GradientColors) {}

  async generateBackground(input: GenerateBackgroundInput): Promise<GenerateBackgroundOutput> {
    const { widthPx, heightPx, industry, topic, companyName } = input;

    const from = escapeSvgAttr(this.colors.primary ?? DEFAULT_GRADIENT[0]);
    const to = escapeSvgAttr(this.colors.secondary ?? this.colors.accent ?? DEFAULT_GRADIENT[1]);
    const rawAccent = escapeSvgAttr(this.colors.accent ?? this.colors.secondary ?? this.colors.primary ?? DEFAULT_GRADIENT[1]);

    // Guaranteed-visible design-element tones (see ensureLightnessContrast's
    // doc comment) — `from`/`to` themselves are never altered, so the base
    // wash always stays this company's true, unmodified brand colors; only
    // the tones drawn ON TOP of it get pushed to a lightness that will
    // actually read as a distinct shape once rendered.
    const baseLightness = (hexToHsl(from).l + hexToHsl(to).l) / 2;
    const accent = ensureLightnessContrast(baseLightness, rawAccent);
    const pop = ensureLightnessContrast(baseLightness, to);
    // A real fourth tone derived from the company's own colors (a
    // lightened blend of `to`/`accent`) rather than reaching for an
    // unrelated hardcoded highlight — every color in every style traces
    // back to this company's actual BrandKit. Mixing two now-distinct
    // tones together can still land back near the base wash (e.g. if
    // they sit on opposite sides of it), so the mix itself gets the same
    // contrast guarantee rather than assuming it inherited one.
    const highlight = ensureLightnessContrast(baseLightness, mixHex(to, accent === to ? from : accent, 0.5));

    const rng = mulberry32(hashSeed(`${companyName}::${topic}`));
    const style = pickStyle(industry as Industry | undefined, rng);
    const svg = STYLE_BUILDERS[style](widthPx, heightPx, { from, to, accent, highlight, pop }, rng);

    const buffer = await sharp(Buffer.from(svg)).png().toBuffer();
    return { buffer, mimeType: "image/png", providerName: this.name };
  }
}

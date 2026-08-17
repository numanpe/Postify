import "server-only";
import sharp from "sharp";

import type { ImageProvider, GenerateBackgroundInput, GenerateBackgroundOutput } from "./types";

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

// The zero-key free path for poster backgrounds: a gradient rendered
// directly from BrandKit colors, no external call, never fails or
// rate-limits. This is the poster-engine equivalent of Phase 2's
// TemplateTextProvider.
export class GradientBackgroundProvider implements ImageProvider {
  readonly name = "Free (brand gradient)";

  constructor(private readonly colors: GradientColors) {}

  async generateBackground({
    widthPx,
    heightPx,
  }: GenerateBackgroundInput): Promise<GenerateBackgroundOutput> {
    const from = escapeSvgAttr(this.colors.primary ?? DEFAULT_GRADIENT[0]);
    const to = escapeSvgAttr(this.colors.secondary ?? this.colors.accent ?? DEFAULT_GRADIENT[1]);

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${widthPx}" height="${heightPx}">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${from}" />
          <stop offset="100%" stop-color="${to}" />
        </linearGradient>
      </defs>
      <rect width="${widthPx}" height="${heightPx}" fill="url(#bg)" />
    </svg>`;

    const buffer = await sharp(Buffer.from(svg)).png().toBuffer();
    return { buffer, mimeType: "image/png", providerName: this.name };
  }
}

import type { SocialPlatform } from "@prisma/client";

import { relativeLuminance } from "./contrast";

// Research-backed design principle (2026-09-03): a poster's accent
// color should pop against the real background of the platform it's
// destined for — Instagram/Facebook/LinkedIn's feed is a white
// surface, TikTok's is black. This never invents a color outside the
// company's own real BrandKit palette (per the principle's own "never
// override the brand's actual colors with generic ones" rule) — it
// only chooses WHICH of the company's real primary/secondary/accent
// colors gets used as the emphasized one, using real relative-
// luminance math (contrast.ts), not a guess.
type FeedBackground = "light" | "dark";

const PLATFORM_FEED_BACKGROUND: Record<SocialPlatform, FeedBackground> = {
  INSTAGRAM: "light",
  FACEBOOK: "light",
  LINKEDIN: "light",
  TIKTOK: "dark",
};

// Only ever called with a real, explicitly known target — see
// generate.ts's own doc comment on targetPlatforms. Returns null (no
// adjustment, real BrandKit default color used unchanged) whenever the
// destination is genuinely ambiguous: no platforms given, or a mix that
// spans both a light-feed and a dark-feed platform in the same
// generation — the principle's own "don't guess if it's ambiguous"
// rule, not silently picking one arbitrarily.
export function resolveFeedBackground(targetPlatforms: SocialPlatform[]): FeedBackground | null {
  if (targetPlatforms.length === 0) return null;
  const backgrounds = new Set(targetPlatforms.map((p) => PLATFORM_FEED_BACKGROUND[p]));
  if (backgrounds.size !== 1) return null;
  return [...backgrounds][0];
}

// Picks whichever of the company's own real brand colors best "pops"
// against the destination feed's real background — darkest (lowest
// luminance) for a light feed, brightest (highest luminance) for a dark
// feed. Colors with no real value are skipped, never substituted with
// an invented one; returns null (caller keeps its own existing default)
// if none of the three are actually set.
export function pickPlatformEmphasisColor(
  colors: { primary?: string | null; secondary?: string | null; accent?: string | null },
  feedBackground: FeedBackground,
): string | null {
  const real = [colors.primary, colors.secondary, colors.accent].filter((c): c is string => Boolean(c));
  if (real.length === 0) return null;

  const withLuminance = real.map((hex) => ({ hex, luminance: relativeLuminance(hex) }));
  withLuminance.sort((a, b) => (feedBackground === "light" ? a.luminance - b.luminance : b.luminance - a.luminance));
  return withLuminance[0].hex;
}

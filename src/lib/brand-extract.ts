import "server-only";
import * as cheerio from "cheerio";

import { fetchPublic, UnsafeUrlError } from "@/lib/net/safe-fetch";

export interface ExtractedBrandAssets {
  logoUrl: string | null;
  colors: string[]; // hex, most-prominent first, real color/white/black already filtered
  themeColor: string | null;
  fontFamilies: string[];
  sourceUrl: string;
}

// Real HTTP fetch + lightweight HTML parsing only — deliberately never a
// headless browser (Task 3's own constraint). This means single-page-app
// sites that render everything client-side in JS will come back mostly
// empty; that's a real, disclosed limitation of this approach, not a
// bug to silently paper over.
const HEX_COLOR_RE = /#(?:[0-9a-fA-F]{3}){1,2}\b/g;

// Near-white/near-black/near-grey reads as noise regardless of exact
// value — almost every site has these somewhere (body text, dividers,
// page background) and they'd otherwise dominate the top of the
// "brand color" list without actually being a brand color. Luminance
// + saturation based rather than a fixed set, so off-whites like
// #fafafa or #f8f8f8 are caught too, not just literal #fff/#000.
function isNoiseColor(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  const saturation = max === 0 ? 0 : (max - min) / max;
  return (luminance > 0.92 || luminance < 0.08) && saturation < 0.15;
}

function resolveUrl(maybeUrl: string | null | undefined, base: URL): string | null {
  if (!maybeUrl) return null;
  try {
    return new URL(maybeUrl, base).toString();
  } catch {
    return null;
  }
}

export class BrandExtractError extends Error {}

export async function extractBrandAssetsFromUrl(rawUrl: string): Promise<ExtractedBrandAssets> {
  let base: URL;
  try {
    base = new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`);
  } catch {
    throw new BrandExtractError("That doesn't look like a valid website URL.");
  }

  let response: Response;
  let finalUrl: URL;
  try {
    ({ response, finalUrl } = await fetchPublic(base, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; PostifyBrandBot/1.0; +https://postify.app)" },
      signal: AbortSignal.timeout(15_000),
    }));
  } catch (error) {
    if (error instanceof UnsafeUrlError) {
      throw new BrandExtractError("That URL isn't reachable — it points to a local or internal address.");
    }
    throw new BrandExtractError(
      `Couldn't reach ${base.hostname}: ${error instanceof Error ? error.message : "network error"}.`,
    );
  }
  if (!response.ok) {
    throw new BrandExtractError(`${base.hostname} returned an error (${response.status}).`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("html")) {
    throw new BrandExtractError(`${base.hostname} didn't return an HTML page.`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // Logo: og:image is the most reliable real-world signal for "the
  // image this site wants shared/represented by" — fall back to a
  // header <img> that looks like a logo, then the favicon.
  const ogImage = $('meta[property="og:image"], meta[name="og:image"]').attr("content");
  const headerLogo = $('header img[src], [class*="logo" i] img[src], img[class*="logo" i][src], img[alt*="logo" i][src]')
    .first()
    .attr("src");
  const favicon = $('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]')
    .first()
    .attr("href");
  const logoUrl = resolveUrl(ogImage, finalUrl) ?? resolveUrl(headerLogo, finalUrl) ?? resolveUrl(favicon, finalUrl);

  const themeColorRaw = $('meta[name="theme-color"]').attr("content")?.trim() ?? null;
  const themeColor = themeColorRaw && /^#[0-9a-fA-F]{3,6}$/.test(themeColorRaw) ? themeColorRaw.toLowerCase() : null;

  // Colors: scan inline <style> blocks and style="" attributes for real
  // hex codes and CSS custom properties — not a guess, actual bytes on
  // the page. Ranked by frequency; pure black/white/near-grey filtered
  // out as noise (almost every site has these regardless of real brand
  // color, so they'd otherwise dominate the top of the list).
  const inlineStyles = $("style")
    .toArray()
    .map((el) => $(el).html() ?? "")
    .join(" ");
  const attrStyles = $("[style]")
    .toArray()
    .map((el) => $(el).attr("style") ?? "")
    .join(" ");
  const styleText = inlineStyles + " " + attrStyles;

  const colorCounts = new Map<string, number>();
  for (const match of styleText.match(HEX_COLOR_RE) ?? []) {
    const normalized = match.length === 4 ? `#${[...match.slice(1)].map((c) => c + c).join("")}` : match.toLowerCase();
    if (isNoiseColor(normalized)) continue;
    colorCounts.set(normalized, (colorCounts.get(normalized) ?? 0) + 1);
  }
  const colors = [...colorCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([hex]) => hex)
    .slice(0, 6);
  if (themeColor && !colors.includes(themeColor)) colors.unshift(themeColor);

  // Typography: real font-family declarations found in inline CSS,
  // deduped, generic fallback keywords filtered out.
  const fontFamilyMatches = styleText.match(/font-family\s*:\s*[^;]+;?/gi) ?? [];
  const genericFonts = new Set(["inherit", "initial", "unset", "serif", "sans-serif", "monospace", "cursive", "fantasy"]);
  const fontFamilies = [
    ...new Set(
      fontFamilyMatches
        .flatMap((decl) =>
          decl
            .replace(/font-family\s*:\s*/i, "")
            .replace(";", "")
            .split(","),
        )
        .map((f) => f.replace(/["']/g, "").trim())
        // CSS custom properties (var(--font-x)) aren't a real, usable
        // font name without resolving the variable's actual value
        // elsewhere in the stylesheet — out of scope for this
        // lightweight extractor, so surface nothing rather than a
        // meaningless "var(--font-mono)" the user can't act on.
        .filter((f) => f && !f.toLowerCase().startsWith("var(") && !genericFonts.has(f.toLowerCase())),
    ),
  ].slice(0, 5);

  return { logoUrl, colors, themeColor, fontFamilies, sourceUrl: finalUrl.toString() };
}

import "server-only";
import * as cheerio from "cheerio";

import { fetchPublic, UnsafeUrlError } from "@/lib/net/safe-fetch";

export interface ExtractedBrandAssets {
  logoUrl: string | null;
  colors: string[]; // hex, most-prominent first, real color/white/black already filtered
  themeColor: string | null;
  fontFamilies: string[];
  sourceUrl: string;
  // Real text signals for business-context derivation (see
  // brand-context.ts) — captured in the same fetch/parse pass as the
  // visual assets above rather than a second round-trip to the site.
  metaDescription: string | null;
  ogDescription: string | null;
  // Cleaned, truncated visible body text — nav/footer/script/style
  // content stripped, not full page text (real pages often run tens of
  // thousands of characters, most of it chrome/boilerplate irrelevant
  // to "what does this business actually do").
  visibleText: string;
  // Part B2's onboarding flow needs a company-name guess so the review
  // screen isn't asking the user to retype something the page already
  // states. og:site_name is the real, purpose-built signal for this;
  // the <title> tag's first segment (before a " | "/" - " separator,
  // which most sites use to append a tagline) is the fallback.
  suggestedName: string | null;
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

// 5 was too low in practice — real testing against github.com (41
// stylesheet links: per-color-theme variants first, then the files
// that actually declare font-family much further down the list) showed
// colors resolving fine but fonts staying empty purely because they
// never got fetched within the old cutoff. The byte cap below still
// bounds total work regardless of how high this is set.
const STYLESHEET_FETCH_LIMIT = 12;
const STYLESHEET_BYTE_CAP = 2_000_000;

// Real bug found by testing against real sites (github.com worked
// because it happens to set <meta name="theme-color"> and inline a
// <style> block; stripe.com and tailwindcss.com came back completely
// empty even though both have obvious, real brand colors and fonts).
// The cause wasn't JS-rendering — tailwindcss.com's colors and fonts
// are sitting in plain hex/font-family declarations in two ordinary
// <link rel="stylesheet"> files that this extractor never fetched at
// all, only inline <style>/style="" content. Most real, non-trivial
// sites (built via Next.js, Webpack, any bundler) put their actual CSS
// in linked files, not inline — so this was the dominant real-world
// failure mode, not an inherent static-HTML limitation. Failures here
// are swallowed per-stylesheet (a blocked/slow/broken CSS file
// shouldn't fail the whole extraction) — this stays a best-effort
// accelerator, same philosophy as the rest of this file.
// Fetched concurrently, not sequentially — a real-world site can list
// 40+ stylesheets (github.com does), and a sequential loop at an 8s
// per-request timeout would let one slow/hanging CSS file stall an
// interactive "paste URL, click Extract" form for up to
// STYLESHEET_FETCH_LIMIT × 8s. Promise.allSettled bounds the whole
// step to roughly one timeout window regardless of count.
async function fetchExternalStylesheets($: cheerio.CheerioAPI, base: URL): Promise<string> {
  const hrefs = $('link[rel="stylesheet"][href]')
    .toArray()
    .map((el) => $(el).attr("href"))
    .map((href) => resolveUrl(href, base))
    .filter((url): url is string => !!url)
    .slice(0, STYLESHEET_FETCH_LIMIT);

  const results = await Promise.allSettled(
    hrefs.map(async (url) => {
      const { response } = await fetchPublic(url, { signal: AbortSignal.timeout(8_000) });
      if (!response.ok) return "";
      return response.text();
    }),
  );

  let combined = "";
  let totalBytes = 0;
  for (const result of results) {
    if (result.status !== "fulfilled" || !result.value) continue;
    if (totalBytes >= STYLESHEET_BYTE_CAP) break;
    totalBytes += result.value.length;
    combined += " " + result.value;
  }
  return combined;
}

// CSS custom properties (--font-inter: "Inter", "Inter Fallback";) are
// how real bundled sites usually wire a font-family declaration to its
// actual value (tailwindcss.com does exactly this) — resolving them
// against the full fetched CSS text (now that external stylesheets are
// included) turns a previously-unusable "var(--font-inter)" into the
// real font name, instead of discarding it.
// Real bug found by testing against tailwindcss.com's actual CSS: a
// naive `.split(",")` on a font-family declaration corrupts values like
// `var(--default-font-family, -apple-system, BlinkMacSystemFont, ...)`
// — a single var() call with its own comma-separated fallback list
// nested inside the parens — into garbage fragments (a truncated,
// unclosed "var(--default-font-family" among them). Splitting only on
// commas at paren-depth 0 keeps a var(...) call intact as one token.
function splitTopLevelCommas(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of value) {
    if (char === "(") depth += 1;
    else if (char === ")") depth -= 1;
    if (char === "," && depth <= 0) {
      parts.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  if (current) parts.push(current);
  return parts;
}

// Real bug found by testing against tailwindcss.com's actual minified
// CSS: `--font-inter:"inter", "inter Fallback"}` — the last declaration
// in a rule, with no trailing `;` before the `}`. Requiring a literal
// `;` terminator (the original version of this regex) silently failed
// to capture exactly the custom properties most likely to matter (the
// final one in a :root block). Terminating on `;` OR a lookahead for
// `}` catches both minified and formatted CSS.
function resolveCustomProperties(styleText: string): Map<string, string> {
  const props = new Map<string, string>();
  const re = /(--[\w-]+)\s*:\s*([^;{}]+)(?:;|(?=\}))/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(styleText))) {
    props.set(match[1], match[2].trim());
  }
  return props;
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

  // Logo: real testing against github.com, stripe.com, and
  // tailwindcss.com (a prior screenshot showed "Logo found" resolving to
  // what looked like a broken/wrong image — this is why) showed the
  // original priority order was backwards on every one of the three:
  // - og:image is a social-share thumbnail, not a logo — github.com's
  //   resolved to an unrelated conference marketing banner.
  // - The unscoped "[class*='logo' i] img"/"img[alt*='logo' i]"
  //   selectors search the WHOLE document, not just the header/nav —
  //   on github.com that matched a customer-logo-carousel image
  //   (Figma's logo); on stripe.com, Hertz's logo. Neither site's own
  //   mark.
  // - The one signal correct on all three real sites: the site's own
  //   favicon/apple-touch-icon.
  // Reordered to match: favicon first (apple-touch-icon preferred when
  // present — typically much higher resolution than a 16x16 favicon.ico
  // and still genuinely the site's own mark), a header/nav-SCOPED logo
  // image second, og:image only as a last resort.
  const appleTouchIcon = $('link[rel="apple-touch-icon"]').first().attr("href");
  const genericFavicon = $('link[rel="icon"], link[rel="shortcut icon"]').first().attr("href");
  const favicon = appleTouchIcon ?? genericFavicon;
  const headerLogo = $(
    'header img[src], nav img[src], header [class*="logo" i] img[src], nav [class*="logo" i] img[src], header img[alt*="logo" i][src], nav img[alt*="logo" i][src]',
  )
    .first()
    .attr("src");
  const ogImage = $('meta[property="og:image"], meta[name="og:image"]').attr("content");
  const logoUrl = resolveUrl(favicon, finalUrl) ?? resolveUrl(headerLogo, finalUrl) ?? resolveUrl(ogImage, finalUrl);

  const themeColorRaw = $('meta[name="theme-color"]').attr("content")?.trim() ?? null;
  const themeColor = themeColorRaw && /^#[0-9a-fA-F]{3,6}$/.test(themeColorRaw) ? themeColorRaw.toLowerCase() : null;

  // Colors: scan inline <style> blocks, style="" attributes, AND linked
  // stylesheets for real hex codes and CSS custom properties — not a
  // guess, actual bytes on the page (or the CSS files it loads). Ranked
  // by frequency; pure black/white/near-grey filtered out as noise
  // (almost every site has these regardless of real brand color, so
  // they'd otherwise dominate the top of the list).
  const inlineStyles = $("style")
    .toArray()
    .map((el) => $(el).html() ?? "")
    .join(" ");
  const attrStyles = $("[style]")
    .toArray()
    .map((el) => $(el).attr("style") ?? "")
    .join(" ");
  const externalStyles = await fetchExternalStylesheets($, finalUrl);
  const styleText = inlineStyles + " " + attrStyles + " " + externalStyles;
  const customProps = resolveCustomProperties(styleText);

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

  // Typography: real font-family declarations found across inline CSS
  // and now the fetched external stylesheets, deduped, generic fallback
  // keywords filtered out. var(--custom-property) references are
  // resolved against customProps when possible (see
  // resolveCustomProperties above) rather than always discarded — a
  // real font name is often only reachable that way on bundled sites.
  // [^;{}]+ (not [^;]+;?) — same minified-CSS fix as
  // resolveCustomProperties above: a declaration with no trailing `;`
  // before `}` must stop at the `}`, or the match runs on into the
  // next CSS rule's selector and declarations.
  const fontFamilyMatches = styleText.match(/font-family\s*:\s*[^;{}]+/gi) ?? [];
  const genericFonts = new Set(["inherit", "initial", "unset", "serif", "sans-serif", "monospace", "cursive", "fantasy"]);
  // Real bug found by testing against tailwindcss.com: its compiled CSS
  // has @property rules with Houdini syntax strings ("<value>") that
  // this scanner has no reason to specifically know about — rather than
  // add one exclusion per CSS construct as they're discovered, a real
  // font name is always just letters/digits/spaces/hyphens of sane
  // length, so anything else (angle brackets, braces, colons, quotes —
  // i.e. CSS syntax that leaked through) is rejected on sight.
  const isPlausibleFontName = (name: string): boolean => /^[\w\s-]{2,60}$/.test(name);
  const resolveFontToken = (token: string): string | null => {
    const cleaned = token.replace(/["']/g, "").trim();
    const varMatch = cleaned.match(/^var\(\s*(--[\w-]+)(?:\s*,.*)?\)$/i);
    let result: string | null;
    if (!varMatch) {
      result = cleaned || null;
    } else {
      const resolved = customProps.get(varMatch[1]);
      result = resolved ? splitTopLevelCommas(resolved)[0]?.replace(/["']/g, "").trim() || null : null;
    }
    // Whether unresolved (fell through the strict var(...) match above
    // on some formatting variant) or resolved to another var(...)
    // (chained indirection) — either way, a leftover "var(" isn't a
    // real, usable font name. Same "surface nothing rather than a
    // meaningless var(...)" rule either path takes.
    return result && !/var\(/i.test(result) ? result : null;
  };
  const fontFamilies = [
    ...new Set(
      fontFamilyMatches
        .flatMap((decl) =>
          splitTopLevelCommas(decl.replace(/font-family\s*:\s*/i, "").replace(";", "")),
        )
        .map((f) => resolveFontToken(f))
        .filter((f): f is string => !!f && isPlausibleFontName(f) && !genericFonts.has(f.toLowerCase())),
    ),
  ].slice(0, 5);

  // Text signals for business-context derivation. Nothing below this
  // point re-uses $ for anything visual, so removing noisy elements
  // in-place (rather than cloning first) is safe.
  const metaDescription = $('meta[name="description"]').attr("content")?.trim() || null;
  const ogDescription =
    $('meta[property="og:description"], meta[name="og:description"]').attr("content")?.trim() || null;

  const ogSiteName = $('meta[property="og:site_name"]').attr("content")?.trim() || null;
  const titleText = $("title").first().text().trim() || null;
  // Most sites append a tagline after a separator ("Acme Corp | Home",
  // "Acme Corp - Cloud Storage") — the segment before it is the real
  // name, the rest is noise for this purpose.
  const titleFirstSegment = titleText ? titleText.split(/\s*[|\-–—]\s*/)[0]?.trim() || null : null;
  const suggestedName = ogSiteName ?? titleFirstSegment;

  $("script, style, noscript, svg, nav, footer, header").remove();
  const visibleText = $("body").text().replace(/\s+/g, " ").trim().slice(0, 3000);

  return {
    logoUrl,
    colors,
    themeColor,
    fontFamilies,
    sourceUrl: finalUrl.toString(),
    metaDescription,
    ogDescription,
    visibleText,
    suggestedName,
  };
}

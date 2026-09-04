import "server-only";

import type { AspectRatio, BackgroundSource, PosterTemplate, SocialPlatform } from "@prisma/client";

import { db } from "@/lib/db";
import { getCompanyContext } from "@/lib/company-context";
import { storage, buildStorageKey } from "@/lib/storage";
import { renderPoster } from "./render";
import { runPosterQualityGate } from "./quality-gate";
import { POSTER_DIMENSIONS } from "./dimensions";
import { POSTER_TEMPLATES } from "./templates";
import { buildPosterBackgroundContext } from "./background-context";
import { smartCropToAspect } from "./smart-crop";
import { resolveFeedBackground, pickPlatformEmphasisColor } from "./platform-color";
import { getBrandGradientProvider, getAiImageProviderForPoster } from "@/lib/providers/image/resolver";
import { ImageProviderError } from "@/lib/providers/image/types";
import { getTextProviderForCompany } from "@/lib/providers/text/resolver";
import { ProviderError } from "@/lib/providers/text/types";
import type { FallbackInfo } from "@/lib/providers/fallback-log";
import { generateQrCodeDataUri } from "./qrcode";

const ASPECT_RATIO_LABEL: Record<AspectRatio, "1:1" | "9:16" | "16:9"> = {
  SQUARE: "1:1",
  STORY: "9:16",
  LANDSCAPE: "16:9",
};

export interface GeneratePosterCoreInput {
  companyId: string;
  userId: string;
  headline: string;
  subhead?: string;
  cta?: string;
  aspectRatio: AspectRatio;
  template: PosterTemplate;
  backgroundSource: BackgroundSource;
  backgroundAssetId?: string;
  // Natural-language poster editing (2026-09-03) — a real per-poster
  // color override that takes precedence over the company's own
  // BrandKit colors for this generation only. Undefined (not just a
  // missing key) for every caller except the edit flow, which always
  // resolves and passes an explicit override even when unchanged from
  // BrandKit — see poster-edit.ts's own doc comment for why.
  colorOverrides?: { primary?: string | null; secondary?: string | null; accent?: string | null };
  // Real edit lineage — set together by the edit flow only. Neither is
  // ever set for an original, non-edited poster.
  parentPosterId?: string;
  editInstruction?: string;
  // Research-backed design principle (2026-09-03): only ever set by a
  // caller with a real, unambiguous target — e.g. a campaign item whose
  // own targetPlatforms is already a single-feed-type list (see
  // process-campaign-items.ts). Never guessed here or by any caller;
  // absent (not just empty) means "no known destination, don't adjust
  // anything" — see platform-color.ts's own doc comment for the actual
  // light/dark-feed color logic.
  targetPlatforms?: SocialPlatform[];
  // Natural-language editing's "add a picture of X" case: the AI
  // background pipeline's real subject cue, when it should be driven by
  // the specific edit instruction rather than the poster's own headline
  // text (which may be about something else entirely, e.g. a headline
  // about a sale with an edit asking for "a delivery truck" background).
  // Defaults to the headline for every other caller, unchanged.
  backgroundTopicHint?: string;
  // Growth Tools #5: an optional real, scannable link baked into the
  // rendered PNG (see templates.tsx's renderQrBadge). Undefined/blank
  // means no QR code at all — never a placeholder, same convention as
  // subhead/cta above.
  qrCodeUrl?: string;
}

export interface GeneratePosterCoreResult {
  posterId: string;
  warnings: string[];
  // Both only set for the AI background path. backgroundProviderName is
  // the real provider that actually generated the background (from the
  // image call's own providerName — "Free AI"/"Free (brand gradient)"
  // if it fell all the way through, not a guessed label). fallbackFrom
  // is only populated when a real runtime-failure fallback actually
  // happened (text's expandBackgroundPrompt and/or image's
  // generateBackground) — real disclosure per Part 3 of the
  // resilient-fallback-chain work, never shown for BRAND/PHOTO
  // backgrounds (no AI provider call at all) or a first-choice provider
  // succeeding normally.
  backgroundProviderName?: string;
  fallbackFrom?: FallbackInfo[];
}

// Thrown for any user-facing failure (quality gate fail, missing photo
// selection, provider error). Both callers — the direct Poster Studio
// action and the campaign job processor (src/lib/jobs/) — catch this
// and adapt the message into their own reporting shape, so the actual
// generation logic exists exactly once.
export class PosterGenerationError extends Error {}

export async function generatePosterCore(
  input: GeneratePosterCoreInput,
): Promise<GeneratePosterCoreResult> {
  const { width, height } = POSTER_DIMENSIONS[input.aspectRatio];

  const isInfographic = input.template === "INFOGRAPHIC_SHOWCASE";

  const [context, brandKit, contactInfo] = await Promise.all([
    getCompanyContext(input.companyId),
    db.brandKit.findUnique({ where: { companyId: input.companyId }, include: { logoAsset: true } }),
    // Only fetched for INFOGRAPHIC_SHOWCASE — every other template has
    // no use for these, no reason to add a column read to every poster
    // generation.
    isInfographic
      ? db.company.findUnique({
          where: { id: input.companyId },
          select: { phone: true, contactEmail: true, whatsappNumber: true, websiteUrl: true },
        })
      : null,
  ]);

  // Real, precedence-ordered color resolution, wherever this poster's
  // colors are read below (background generation included, not just
  // the text/logo overlay): an explicit natural-language edit override
  // always wins; otherwise, when a real single-feed-type target
  // platform is known, the company's own real brand color that best
  // pops against that platform's actual feed background; otherwise the
  // company's plain BrandKit default, unchanged from before this
  // feature existed.
  const feedBackground = input.targetPlatforms ? resolveFeedBackground(input.targetPlatforms) : null;
  const platformEmphasisAccent = feedBackground
    ? pickPlatformEmphasisColor(
        { primary: brandKit?.primaryColor, secondary: brandKit?.secondaryColor, accent: brandKit?.accentColor },
        feedBackground,
      )
    : null;
  const resolvedColors = {
    primary: input.colorOverrides?.primary ?? brandKit?.primaryColor,
    secondary: input.colorOverrides?.secondary ?? brandKit?.secondaryColor,
    accent: input.colorOverrides?.accent ?? platformEmphasisAccent ?? brandKit?.accentColor,
  };

  const gate = runPosterQualityGate({
    headline: input.headline,
    companyLocale: context.locale,
    aspectRatio: input.aspectRatio,
    contrastSpec: POSTER_TEMPLATES[input.template].contrastSpec,
  });
  if (!gate.passed) {
    const failMessages = gate.issues.filter((issue) => issue.severity === "fail").map((issue) => issue.message);
    throw new PosterGenerationError(failMessages.join(" "));
  }
  const warnings = gate.issues.filter((issue) => issue.severity === "warning").map((issue) => issue.message);

  // Fetched once, ahead of the background-source branch, since the AI
  // path's Stage 1 context (below) and the final render both need it —
  // one real logo lookup driving both, not two.
  const logoBuffer = brandKit?.logoAsset ? await storage.get(brandKit.logoAsset.storageKey) : null;
  const logoMimeType = brandKit?.logoAsset?.mimeType ?? null;

  let backgroundBuffer: Buffer;
  let backgroundMimeType: string;
  let resolvedBackgroundAssetId: string | undefined;
  let backgroundProviderName: string | undefined;
  const fallbackFrom: FallbackInfo[] = [];
  const backgroundTopic = input.backgroundTopicHint ?? input.headline;

  if (input.backgroundSource === "BRAND") {
    const provider = getBrandGradientProvider(resolvedColors);
    const result = await provider.generateBackground({
      companyName: context.name,
      industry: context.industry,
      tone: context.tone,
      topic: backgroundTopic,
      widthPx: width,
      heightPx: height,
    });
    backgroundBuffer = result.buffer;
    backgroundMimeType = result.mimeType;
  } else if (input.backgroundSource === "PHOTO") {
    if (!input.backgroundAssetId) {
      throw new PosterGenerationError("Choose a photo from your Media Library.");
    }
    const asset = await db.mediaAsset.findFirst({
      where: { id: input.backgroundAssetId, companyId: input.companyId },
    });
    if (!asset || !asset.mimeType.startsWith("image/")) {
      throw new PosterGenerationError("That photo could not be found.");
    }
    const rawPhotoBuffer = await storage.get(asset.storageKey);
    // Smart, subject-aware framing instead of a dead-center crop — real
    // product/vehicle photos are rarely composed with the subject
    // exactly centered, and a plain object-fit: cover crop regularly cut
    // off cars, logos, or faces near the edges. Falls back to a
    // safe center-cover resize (never a thrown error) if the source
    // image's dimensions can't be read.
    try {
      backgroundBuffer = await smartCropToAspect(rawPhotoBuffer, width, height);
    } catch {
      backgroundBuffer = rawPhotoBuffer;
    }
    // sharp preserves the source format by default (no .png()/.jpeg()
    // call in smart-crop.ts), so the original mimeType is still accurate.
    backgroundMimeType = asset.mimeType;
    resolvedBackgroundAssetId = asset.id;
  } else {
    // Two-stage pipeline: Stage 1 (background-context.ts) shapes the
    // real Company/BrandKit data already fetched above into the loose
    // visual-guidance channel; Stage 2 (TextProvider.expandBackgroundPrompt)
    // expands that + the headline into a concrete generation prompt.
    // Stage 2 reuses the exact same free/BYOK text provider resolution
    // as scripts/captions, so this also works with zero keys.
    const { backgroundGeneratorContext } = buildPosterBackgroundContext({
      context,
      brandKit,
      logoBuffer,
      logoMimeType,
      headline: backgroundTopic,
      template: input.template,
    });

    const textProvider = await getTextProviderForCompany(input.companyId);
    let expanded;
    try {
      expanded = await textProvider.expandBackgroundPrompt({
        rawUserPrompt: backgroundTopic,
        industry: backgroundGeneratorContext.industry,
        visualTone: backgroundGeneratorContext.visualTone,
        accentColorsForBackground: backgroundGeneratorContext.accentColorsForBackground,
        forbiddenStyles: backgroundGeneratorContext.forbiddenStyles,
        layoutDirection: backgroundGeneratorContext.layoutDirection,
        aspectRatio: ASPECT_RATIO_LABEL[input.aspectRatio],
        reservesTextSpace: POSTER_TEMPLATES[input.template].contrastSpec.kind === "overlay",
      });
    } catch (error) {
      if (error instanceof ProviderError) {
        throw new PosterGenerationError(`${error.providerName}: ${error.message}`);
      }
      throw error;
    }
    if (expanded.fallbackFrom) fallbackFrom.push(...expanded.fallbackFrom);

    // Never null and never throws for the free-tier case — the shared
    // Cloudflare pool (no key) falls through to the brand gradient
    // internally on any failure; BYOK still throws real errors below,
    // caught same as always. See resolver.ts / shared-image-pool.ts.
    const provider = await getAiImageProviderForPoster(input.companyId, resolvedColors);
    try {
      const result = await provider.generateBackground({
        companyName: context.name,
        industry: context.industry,
        tone: context.tone,
        topic: backgroundTopic,
        widthPx: width,
        heightPx: height,
        expandedPrompt: expanded.expandedVisualPrompt,
        negativePrompt: expanded.negativePrompt,
      });
      backgroundBuffer = result.buffer;
      backgroundMimeType = result.mimeType;
      backgroundProviderName = result.providerName;
      if (result.fallbackFrom) fallbackFrom.push(...result.fallbackFrom);
    } catch (error) {
      if (error instanceof ImageProviderError) {
        throw new PosterGenerationError(`${error.providerName}: ${error.message}`);
      }
      throw error;
    }
  }

  // INFOGRAPHIC_SHOWCASE's icon-benefit rows + trust badges — real,
  // topic-grounded text via the resolved text provider (free tier falls
  // back to real per-industry content, see TemplateProvider's own doc
  // comment on generatePosterHighlights). Only fetched for this
  // template; every other template has no use for it.
  let highlights: { benefits: { headline: string; subtext: string }[]; trustBadges: string[] } | undefined;
  if (isInfographic) {
    const textProvider = await getTextProviderForCompany(input.companyId);
    try {
      const result = await textProvider.generatePosterHighlights({ context, topic: input.headline });
      highlights = { benefits: result.benefits, trustBadges: result.trustBadges };
      if (result.fallbackFrom) fallbackFrom.push(...result.fallbackFrom);
    } catch (error) {
      if (error instanceof ProviderError) {
        throw new PosterGenerationError(`${error.providerName}: ${error.message}`);
      }
      throw error;
    }
  }

  // Pure, deterministic, offline encoding — no provider/network call, so
  // no fallback chain needed the way AI text/image steps above have one.
  const qrCodeDataUri = input.qrCodeUrl ? await generateQrCodeDataUri(input.qrCodeUrl) : null;

  const rendered = await renderPoster({
    headline: input.headline,
    subhead: input.subhead,
    cta: input.cta,
    aspectRatio: input.aspectRatio,
    template: input.template,
    backgroundBuffer,
    backgroundMimeType,
    logoBuffer,
    logoMimeType,
    qrCodeDataUri,
    companyName: context.name,
    benefits: highlights?.benefits,
    trustBadges: highlights?.trustBadges,
    contact: contactInfo
      ? { phone: contactInfo.phone, whatsapp: contactInfo.whatsappNumber, email: contactInfo.contactEmail, website: contactInfo.websiteUrl }
      : undefined,
    brandColors: resolvedColors,
  });

  const storageKey = buildStorageKey(input.companyId, `poster-${input.aspectRatio.toLowerCase()}.png`);
  await storage.put(storageKey, rendered.png);

  const orientation =
    rendered.width === rendered.height
      ? "square"
      : rendered.width > rendered.height
        ? "landscape"
        : "portrait";

  const asset = await db.mediaAsset.create({
    data: {
      companyId: input.companyId,
      uploadedById: input.userId,
      storageKey,
      fileName: `poster-${Date.now()}.png`,
      mimeType: "image/png",
      sizeBytes: rendered.png.byteLength,
      width: rendered.width,
      height: rendered.height,
      orientation,
    },
  });

  // Only persisted as a real override when it genuinely differs from
  // the company's own current BrandKit color — an edit that didn't
  // touch colors shouldn't leave a redundant override sitting on the
  // new poster; a later real BrandKit color change should still show
  // up on this poster the same way it would on any unedited one.
  const colorOverrideToStore = (resolved: string | null | undefined, brandDefault: string | null | undefined) =>
    resolved && resolved !== brandDefault ? resolved : null;

  const poster = await db.poster.create({
    data: {
      companyId: input.companyId,
      assetId: asset.id,
      headline: input.headline,
      subhead: input.subhead,
      cta: input.cta,
      aspectRatio: input.aspectRatio,
      template: input.template,
      backgroundSource: input.backgroundSource,
      backgroundAssetId: resolvedBackgroundAssetId,
      overridePrimaryColor: colorOverrideToStore(resolvedColors.primary, brandKit?.primaryColor),
      overrideSecondaryColor: colorOverrideToStore(resolvedColors.secondary, brandKit?.secondaryColor),
      overrideAccentColor: colorOverrideToStore(resolvedColors.accent, brandKit?.accentColor),
      parentPosterId: input.parentPosterId,
      editInstruction: input.editInstruction,
      qrCodeUrl: input.qrCodeUrl,
    },
  });

  return {
    posterId: poster.id,
    warnings,
    backgroundProviderName,
    fallbackFrom: fallbackFrom.length > 0 ? fallbackFrom : undefined,
  };
}

import "server-only";

import type { AspectRatio, BackgroundSource, PosterTemplate } from "@prisma/client";

import { db } from "@/lib/db";
import { getCompanyContext } from "@/lib/company-context";
import { storage, buildStorageKey } from "@/lib/storage";
import { renderPoster } from "./render";
import { runPosterQualityGate } from "./quality-gate";
import { POSTER_DIMENSIONS } from "./dimensions";
import { POSTER_TEMPLATES } from "./templates";
import { buildPosterBackgroundContext } from "./background-context";
import { smartCropToAspect } from "./smart-crop";
import { getBrandGradientProvider, getAiImageProviderForPoster } from "@/lib/providers/image/resolver";
import { ImageProviderError } from "@/lib/providers/image/types";
import { getTextProviderForCompany } from "@/lib/providers/text/resolver";
import { ProviderError } from "@/lib/providers/text/types";
import type { FallbackInfo } from "@/lib/providers/fallback-log";

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

  if (input.backgroundSource === "BRAND") {
    const provider = getBrandGradientProvider({
      primary: brandKit?.primaryColor,
      secondary: brandKit?.secondaryColor,
      accent: brandKit?.accentColor,
    });
    const result = await provider.generateBackground({
      companyName: context.name,
      industry: context.industry,
      tone: context.tone,
      topic: input.headline,
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
      headline: input.headline,
      template: input.template,
    });

    const textProvider = await getTextProviderForCompany(input.companyId);
    let expanded;
    try {
      expanded = await textProvider.expandBackgroundPrompt({
        rawUserPrompt: input.headline,
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
    const provider = await getAiImageProviderForPoster(input.companyId, {
      primary: brandKit?.primaryColor,
      secondary: brandKit?.secondaryColor,
      accent: brandKit?.accentColor,
    });
    try {
      const result = await provider.generateBackground({
        companyName: context.name,
        industry: context.industry,
        tone: context.tone,
        topic: input.headline,
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
    companyName: context.name,
    benefits: highlights?.benefits,
    trustBadges: highlights?.trustBadges,
    contact: contactInfo
      ? { phone: contactInfo.phone, whatsapp: contactInfo.whatsappNumber, email: contactInfo.contactEmail, website: contactInfo.websiteUrl }
      : undefined,
    brandColors: {
      primary: brandKit?.primaryColor,
      secondary: brandKit?.secondaryColor,
      accent: brandKit?.accentColor,
    },
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
    },
  });

  return {
    posterId: poster.id,
    warnings,
    backgroundProviderName,
    fallbackFrom: fallbackFrom.length > 0 ? fallbackFrom : undefined,
  };
}

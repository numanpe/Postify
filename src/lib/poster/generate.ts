import "server-only";

import type { AspectRatio, BackgroundSource } from "@prisma/client";

import { db } from "@/lib/db";
import { getCompanyContext } from "@/lib/company-context";
import { storage, buildStorageKey } from "@/lib/storage";
import { renderPoster } from "./render";
import { runPosterQualityGate } from "./quality-gate";
import { POSTER_DIMENSIONS } from "./dimensions";
import { getBrandGradientProvider, getAiImageProviderForCompany } from "@/lib/providers/image/resolver";
import { ImageProviderError } from "@/lib/providers/image/types";

export interface GeneratePosterCoreInput {
  companyId: string;
  userId: string;
  headline: string;
  subhead?: string;
  cta?: string;
  aspectRatio: AspectRatio;
  backgroundSource: BackgroundSource;
  backgroundAssetId?: string;
}

export interface GeneratePosterCoreResult {
  posterId: string;
  warnings: string[];
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

  const [context, brandKit] = await Promise.all([
    getCompanyContext(input.companyId),
    db.brandKit.findUnique({ where: { companyId: input.companyId }, include: { logoAsset: true } }),
  ]);

  const gate = runPosterQualityGate({
    headline: input.headline,
    companyLocale: context.locale,
    aspectRatio: input.aspectRatio,
  });
  if (!gate.passed) {
    const failMessages = gate.issues.filter((issue) => issue.severity === "fail").map((issue) => issue.message);
    throw new PosterGenerationError(failMessages.join(" "));
  }
  const warnings = gate.issues.filter((issue) => issue.severity === "warning").map((issue) => issue.message);

  let backgroundBuffer: Buffer;
  let backgroundMimeType: string;
  let resolvedBackgroundAssetId: string | undefined;

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
    backgroundBuffer = await storage.get(asset.storageKey);
    backgroundMimeType = asset.mimeType;
    resolvedBackgroundAssetId = asset.id;
  } else {
    const provider = await getAiImageProviderForCompany(input.companyId);
    if (!provider) {
      throw new PosterGenerationError("Add an OpenAI key in Settings to generate AI backgrounds.");
    }
    try {
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
    } catch (error) {
      if (error instanceof ImageProviderError) {
        throw new PosterGenerationError(`${error.providerName}: ${error.message}`);
      }
      throw error;
    }
  }

  const logoBuffer = brandKit?.logoAsset ? await storage.get(brandKit.logoAsset.storageKey) : null;
  const logoMimeType = brandKit?.logoAsset?.mimeType ?? null;

  const rendered = await renderPoster({
    headline: input.headline,
    subhead: input.subhead,
    cta: input.cta,
    aspectRatio: input.aspectRatio,
    backgroundBuffer,
    backgroundMimeType,
    logoBuffer,
    logoMimeType,
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
      backgroundSource: input.backgroundSource,
      backgroundAssetId: resolvedBackgroundAssetId,
    },
  });

  return { posterId: poster.id, warnings };
}

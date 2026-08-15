"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requireCompany } from "@/lib/session";
import { getCompanyContext } from "@/lib/company-context";
import { storage, buildStorageKey } from "@/lib/storage";
import { renderPoster } from "@/lib/poster/render";
import { runPosterQualityGate } from "@/lib/poster/quality-gate";
import { POSTER_DIMENSIONS } from "@/lib/poster/dimensions";
import { getBrandGradientProvider, getAiImageProviderForCompany } from "@/lib/providers/image/resolver";
import { ImageProviderError } from "@/lib/providers/image/types";

export type GeneratePosterState =
  | { status: "error"; error: string }
  | { status: "success"; posterId: string; warnings: string[] }
  | undefined;

// Max lengths are sized to the render pipeline's own worst-case
// assumption (up to 3 wrapped headline lines, 2 wrapped subhead lines)
// — see quality-gate.ts's headlineTopFraction. This is the structural
// no-clipping guarantee: input can't exceed what the layout was proven
// to fit, rather than an auto-shrink-to-fit loop.
const PosterSchema = z.object({
  headline: z
    .string()
    .trim()
    .min(1, "Headline is required.")
    .max(70, "Keep the headline under 70 characters so it doesn't overflow."),
  subhead: z
    .string()
    .trim()
    .max(120, "Keep the subhead under 120 characters.")
    .optional()
    .transform((value) => value || undefined),
  cta: z
    .string()
    .trim()
    .max(30, "Keep the call-to-action under 30 characters.")
    .optional()
    .transform((value) => value || undefined),
  aspectRatio: z.enum(["SQUARE", "STORY", "LANDSCAPE"]),
  backgroundSource: z.enum(["BRAND", "PHOTO", "AI"]),
  backgroundAssetId: z
    .string()
    .optional()
    .transform((value) => value || undefined),
});

export async function generatePoster(
  _prevState: GeneratePosterState,
  formData: FormData,
): Promise<GeneratePosterState> {
  const { user, company } = await requireCompany();

  const parsed = PosterSchema.safeParse({
    headline: formData.get("headline"),
    subhead: formData.get("subhead"),
    cta: formData.get("cta"),
    aspectRatio: formData.get("aspectRatio"),
    backgroundSource: formData.get("backgroundSource"),
    backgroundAssetId: formData.get("backgroundAssetId"),
  });

  if (!parsed.success) {
    return { status: "error", error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { headline, subhead, cta, aspectRatio, backgroundSource, backgroundAssetId } = parsed.data;
  const { width, height } = POSTER_DIMENSIONS[aspectRatio];

  const [context, brandKit] = await Promise.all([
    getCompanyContext(company.id),
    db.brandKit.findUnique({ where: { companyId: company.id }, include: { logoAsset: true } }),
  ]);

  const gate = runPosterQualityGate({ headline, companyLocale: context.locale, aspectRatio });
  if (!gate.passed) {
    const failMessages = gate.issues
      .filter((issue) => issue.severity === "fail")
      .map((issue) => issue.message);
    return { status: "error", error: failMessages.join(" ") };
  }
  const warnings = gate.issues
    .filter((issue) => issue.severity === "warning")
    .map((issue) => issue.message);

  let backgroundBuffer: Buffer;
  let backgroundMimeType: string;
  let resolvedBackgroundAssetId: string | undefined;

  if (backgroundSource === "BRAND") {
    const provider = getBrandGradientProvider({
      primary: brandKit?.primaryColor,
      secondary: brandKit?.secondaryColor,
      accent: brandKit?.accentColor,
    });
    const result = await provider.generateBackground({
      companyName: context.name,
      industry: context.industry,
      tone: context.tone,
      topic: headline,
      widthPx: width,
      heightPx: height,
    });
    backgroundBuffer = result.buffer;
    backgroundMimeType = result.mimeType;
  } else if (backgroundSource === "PHOTO") {
    if (!backgroundAssetId) {
      return { status: "error", error: "Choose a photo from your Media Library." };
    }
    const asset = await db.mediaAsset.findFirst({
      where: { id: backgroundAssetId, companyId: company.id },
    });
    if (!asset || !asset.mimeType.startsWith("image/")) {
      return { status: "error", error: "That photo could not be found." };
    }
    backgroundBuffer = await storage.get(asset.storageKey);
    backgroundMimeType = asset.mimeType;
    resolvedBackgroundAssetId = asset.id;
  } else {
    const provider = await getAiImageProviderForCompany(company.id);
    if (!provider) {
      return { status: "error", error: "Add an OpenAI key in Settings to generate AI backgrounds." };
    }
    try {
      const result = await provider.generateBackground({
        companyName: context.name,
        industry: context.industry,
        tone: context.tone,
        topic: headline,
        widthPx: width,
        heightPx: height,
      });
      backgroundBuffer = result.buffer;
      backgroundMimeType = result.mimeType;
    } catch (error) {
      if (error instanceof ImageProviderError) {
        return { status: "error", error: `${error.providerName}: ${error.message}` };
      }
      throw error;
    }
  }

  const logoBuffer = brandKit?.logoAsset ? await storage.get(brandKit.logoAsset.storageKey) : null;
  const logoMimeType = brandKit?.logoAsset?.mimeType ?? null;

  const rendered = await renderPoster({
    headline,
    subhead,
    cta,
    aspectRatio,
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

  const storageKey = buildStorageKey(company.id, `poster-${aspectRatio.toLowerCase()}.png`);
  await storage.put(storageKey, rendered.png);

  const orientation =
    rendered.width === rendered.height
      ? "square"
      : rendered.width > rendered.height
        ? "landscape"
        : "portrait";

  const asset = await db.mediaAsset.create({
    data: {
      companyId: company.id,
      uploadedById: user.id,
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
      companyId: company.id,
      assetId: asset.id,
      headline,
      subhead,
      cta,
      aspectRatio,
      backgroundSource,
      backgroundAssetId: resolvedBackgroundAssetId,
    },
  });

  revalidatePath("/poster");
  return { status: "success", posterId: poster.id, warnings };
}

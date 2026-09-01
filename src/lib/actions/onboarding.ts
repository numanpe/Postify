"use server";

import { z } from "zod";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { INDUSTRIES, type Industry } from "@/lib/industries";
import { createMediaAssetFromFile } from "@/lib/media";
import { fetchPublic } from "@/lib/net/safe-fetch";
import { extractBrandAssetsFromUrl, BrandExtractError, type ExtractedBrandAssets } from "@/lib/brand-extract";
import { deriveBusinessContext } from "@/lib/brand-context";
import { inferIndustryFromText } from "@/lib/industry-infer";
import { resolveSharedOrTemplateTextProvider } from "@/lib/providers/text/shared-pool";
import type { SummarizeBusinessContextOutput } from "@/lib/providers/text/types";

export type OnboardingExtractState =
  | { status: "error"; error: string }
  | {
      status: "success";
      assets: ExtractedBrandAssets;
      businessContext: SummarizeBusinessContextOutput;
      suggestedIndustry: Industry | null;
    }
  | undefined;

const UrlSchema = z.string().trim().min(3, "Enter a website URL.").max(500);

// Part B2's website-first onboarding step — runs BEFORE a Company row
// exists, so unlike brand-extract.ts's existing action (which resolves
// a company's own BYOK-or-free text provider via getTextProviderForCompany),
// there's no company to resolve a BYOK credential for yet. BYOK is
// therefore never available here — but the platform-held Free AI pool
// (resolveSharedOrTemplateTextProvider) genuinely is: it needs no
// company or key, only PLATFORM_GEMINI_API_KEY, and already falls back
// to the same heuristic template on its own if that's unset or
// exhausted for the day. Previously this hardcoded the template
// unconditionally, meaning the single most common moment this feature
// runs (a brand-new signup) never got the real LLM upgrade at all.
export async function extractOnboardingContext(
  _prevState: OnboardingExtractState,
  formData: FormData,
): Promise<OnboardingExtractState> {
  await requireUser();

  const parsed = UrlSchema.safeParse(formData.get("websiteUrl"));
  if (!parsed.success) {
    return { status: "error", error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    const assets = await extractBrandAssetsFromUrl(parsed.data);
    const provider = await resolveSharedOrTemplateTextProvider();
    const businessContext = await deriveBusinessContext(assets, assets.suggestedName ?? "this company", provider);
    const suggestedIndustry = inferIndustryFromText(`${businessContext.description} ${assets.visibleText}`);
    return { status: "success", assets, businessContext, suggestedIndustry };
  } catch (error) {
    if (error instanceof BrandExtractError) {
      return { status: "error", error: error.message };
    }
    throw error;
  }
}

export type CreateCompanyFromOnboardingState = { error: string } | { success: true } | undefined;

const hexColor = z
  .string()
  .trim()
  .nullish()
  .transform((value) => (value ? value : undefined))
  .refine((value) => value === undefined || /^#[0-9a-fA-F]{6}$/.test(value), {
    message: "Colors must be a hex value like #1A2B3C.",
  });

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => (value ? value : undefined));

const CreateCompanyFromOnboardingSchema = z.object({
  name: z.string().trim().min(1, "Company name is required.").max(200),
  primaryIndustry: z.enum(INDUSTRIES),
  secondaryNiches: z
    .string()
    .trim()
    .transform((value) =>
      value
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  locale: z.enum(["EN", "AR"]),
  businessDescription: optionalText(1000),
  tone: optionalText(300),
  logoImportUrl: optionalText(2000),
  primaryColor: hexColor,
  secondaryColor: hexColor,
  accentColor: hexColor,
  fontHeading: optionalText(100),
  fontBody: optionalText(100),
});

// The website-extracted path's real save — creates Company +
// CompanyMember + CreativeDna + (if any visual data was reviewed/kept)
// BrandKit, all from ONE reviewed screen. The manual "skip" path keeps
// using the existing, unmodified createCompany/CreateCompanyForm (see
// company.ts) — this is a separate action, not a shared one, because
// this one additionally has visual assets to apply.
export async function createCompanyFromOnboarding(
  _prevState: CreateCompanyFromOnboardingState,
  formData: FormData,
): Promise<CreateCompanyFromOnboardingState> {
  const user = await requireUser();

  const parsed = CreateCompanyFromOnboardingSchema.safeParse({
    name: formData.get("name"),
    primaryIndustry: formData.get("primaryIndustry"),
    secondaryNiches: formData.get("secondaryNiches") ?? "",
    locale: formData.get("locale"),
    businessDescription: formData.get("businessDescription"),
    tone: formData.get("tone"),
    logoImportUrl: formData.get("logoImportUrl"),
    primaryColor: formData.get("primaryColor"),
    secondaryColor: formData.get("secondaryColor"),
    accentColor: formData.get("accentColor"),
    fontHeading: formData.get("fontHeading"),
    fontBody: formData.get("fontBody"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const {
    name,
    primaryIndustry,
    secondaryNiches,
    locale,
    businessDescription,
    tone,
    logoImportUrl,
    primaryColor,
    secondaryColor,
    accentColor,
    fontHeading,
    fontBody,
  } = parsed.data;

  const company = await db.$transaction(async (tx) => {
    const created = await tx.company.create({
      data: { name, primaryIndustry, secondaryNiches, locale, businessDescription },
    });
    await tx.companyMember.create({ data: { userId: user.id, companyId: created.id, role: "OWNER" } });
    const toneDescriptors = tone
      ? tone
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : [];
    await tx.creativeDna.create({ data: { companyId: created.id, toneDescriptors } });
    return created;
  });

  // Logo download happens after the company exists (its storage key is
  // built from a real companyId) — same real download-then-store
  // pattern updateBrandKit already uses for the identical import-URL
  // case. A failed/blocked download doesn't fail company creation; a
  // fresh company with no logo yet is a normal, real state (the user
  // can add one from Brand Kit settings), not an error.
  let logoAssetId: string | undefined;
  if (logoImportUrl) {
    try {
      const { response } = await fetchPublic(logoImportUrl, { signal: AbortSignal.timeout(15_000) });
      const contentType = response.headers.get("content-type") ?? "";
      if (response.ok && contentType.startsWith("image/")) {
        const buffer = Buffer.from(await response.arrayBuffer());
        const extension = contentType.split("/")[1]?.split(";")[0] ?? "png";
        const file = new File([buffer], `imported-logo.${extension}`, { type: contentType });
        const asset = await createMediaAssetFromFile({ companyId: company.id, uploadedById: user.id, file });
        logoAssetId = asset.id;
      }
    } catch {
      // Best-effort — see comment above.
    }
  }

  if (logoAssetId || primaryColor || secondaryColor || accentColor || fontHeading || fontBody) {
    await db.brandKit.create({
      data: {
        companyId: company.id,
        ...(logoAssetId ? { logoAssetId } : {}),
        ...(primaryColor ? { primaryColor } : {}),
        ...(secondaryColor ? { secondaryColor } : {}),
        ...(accentColor ? { accentColor } : {}),
        ...(fontHeading ? { fontHeading } : {}),
        ...(fontBody ? { fontBody } : {}),
      },
    });
  }

  return { success: true };
}

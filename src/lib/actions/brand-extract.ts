"use server";

import { z } from "zod";

import { requireCompany } from "@/lib/session";
import { extractBrandAssetsFromUrl, BrandExtractError, type ExtractedBrandAssets } from "@/lib/brand-extract";
import { deriveBusinessContext } from "@/lib/brand-context";
import { getTextProviderForCompany } from "@/lib/providers/text/resolver";
import type { SummarizeBusinessContextOutput } from "@/lib/providers/text/types";

export type BrandExtractState =
  | { status: "error"; error: string }
  | { status: "success"; assets: ExtractedBrandAssets; businessContext: SummarizeBusinessContextOutput | null }
  | undefined;

const UrlSchema = z.string().trim().min(3, "Enter a website URL.").max(500);

// Read-only — never writes to BrandKit, Company, or CreativeDna itself.
// The extracted values are returned to the client for the user to
// review/edit; only a real explicit submit (updateBrandKit for the
// visual assets, applyExtractedBusinessContext for description/tone/
// niches) ever saves anything, so nothing here can silently overwrite
// existing data.
export async function extractBrandFromWebsite(
  _prevState: BrandExtractState,
  formData: FormData,
): Promise<BrandExtractState> {
  const { company } = await requireCompany();

  const parsed = UrlSchema.safeParse(formData.get("websiteUrl"));
  if (!parsed.success) {
    return { status: "error", error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    const assets = await extractBrandAssetsFromUrl(parsed.data);

    // Business-context derivation (Part A2) is a real best-effort
    // add-on to the visual extraction, not a hard requirement of it —
    // if the company's resolved text provider (BYOK or the free
    // heuristic) fails for some reason, the visual extraction the user
    // actually asked for should still succeed rather than the whole
    // action failing on a secondary step.
    let businessContext: SummarizeBusinessContextOutput | null = null;
    try {
      const textProvider = await getTextProviderForCompany(company.id);
      businessContext = await deriveBusinessContext(assets, company.name, textProvider);
    } catch {
      businessContext = null;
    }

    return { status: "success", assets, businessContext };
  } catch (error) {
    if (error instanceof BrandExtractError) {
      return { status: "error", error: error.message };
    }
    throw error;
  }
}

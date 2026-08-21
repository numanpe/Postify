"use server";

import { z } from "zod";

import { requireCompany } from "@/lib/session";
import { extractBrandAssetsFromUrl, BrandExtractError, type ExtractedBrandAssets } from "@/lib/brand-extract";

export type BrandExtractState =
  | { status: "error"; error: string }
  | { status: "success"; assets: ExtractedBrandAssets }
  | undefined;

const UrlSchema = z.string().trim().min(3, "Enter a website URL.").max(500);

// Read-only — never writes to BrandKit itself. The extracted values are
// returned to the client for the user to review/edit in the *existing*
// Brand Kit form's own fields; only that form's real submit
// (updateBrandKit) ever saves anything, so a saved brand can never be
// silently overwritten by this.
export async function extractBrandFromWebsite(
  _prevState: BrandExtractState,
  formData: FormData,
): Promise<BrandExtractState> {
  await requireCompany();

  const parsed = UrlSchema.safeParse(formData.get("websiteUrl"));
  if (!parsed.success) {
    return { status: "error", error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    const assets = await extractBrandAssetsFromUrl(parsed.data);
    return { status: "success", assets };
  } catch (error) {
    if (error instanceof BrandExtractError) {
      return { status: "error", error: error.message };
    }
    throw error;
  }
}

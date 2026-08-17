"use server";

import { z } from "zod";

import { requireCompany } from "@/lib/session";
import { generatePosterCore, PosterGenerationError } from "@/lib/poster/generate";

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
  template: z.enum(["MINIMAL", "BOLD_HEADLINE", "PROMOTIONAL_BANNER", "SPLIT_PRODUCT"]),
  backgroundSource: z.enum(["BRAND", "PHOTO", "AI"]),
  // .nullish() (not .optional()) — formData.get() returns null, not
  // undefined, for a field that's absent from the form entirely (the
  // <select> here is conditionally rendered only when the company has
  // uploaded photos), and .optional() alone rejects null.
  backgroundAssetId: z
    .string()
    .nullish()
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
    template: formData.get("template"),
    backgroundSource: formData.get("backgroundSource"),
    backgroundAssetId: formData.get("backgroundAssetId"),
  });

  if (!parsed.success) {
    return { status: "error", error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    const result = await generatePosterCore({
      companyId: company.id,
      userId: user.id,
      ...parsed.data,
    });
    // Poster list refresh happens client-side (poster-form.tsx's
    // router.refresh() on success) instead of here — avoids a metered
    // ISR write on every single generation. See README's ISR Writes note.
    return { status: "success", posterId: result.posterId, warnings: result.warnings };
  } catch (error) {
    if (error instanceof PosterGenerationError) {
      return { status: "error", error: error.message };
    }
    throw error;
  }
}

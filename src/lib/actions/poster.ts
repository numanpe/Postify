"use server";

import { z } from "zod";

import { db } from "@/lib/db";
import { requireCompany } from "@/lib/session";
import { generatePosterCore, PosterGenerationError } from "@/lib/poster/generate";
import type { FallbackInfo } from "@/lib/providers/fallback-log";

export type GeneratePosterState =
  | { status: "error"; error: string }
  | {
      status: "success";
      posterId: string;
      warnings: string[];
      backgroundProviderName?: string;
      fallbackFrom?: FallbackInfo[];
    }
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
  // Real, separately-found bug (unrelated to Creative DNA signals, but
  // touched the same "template" concept directly): this enum only had
  // 4 of PosterTemplate's real 7 values, missing MODERN_BANNER/
  // BADGE_OFFER/MINIMALIST_FRAME even though poster-form.tsx's
  // TEMPLATE_IDS and templates.tsx's actual renderers have all 7 —
  // selecting any of the 3 missing ones failed real form submissions
  // with "Invalid input."
  template: z.enum(["MINIMAL", "BOLD_HEADLINE", "PROMOTIONAL_BANNER", "SPLIT_PRODUCT", "MODERN_BANNER", "BADGE_OFFER", "MINIMALIST_FRAME"]),
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
    return { status: "success", posterId: result.posterId, warnings: result.warnings, backgroundProviderName: result.backgroundProviderName, fallbackFrom: result.fallbackFrom };
  } catch (error) {
    if (error instanceof PosterGenerationError) {
      return { status: "error", error: error.message };
    }
    throw error;
  }
}

// The real, scoped mitigation for the Cloudflare "Free AI" pool's known
// text-hallucination rate (see project memory — OCR-based auto-detection
// was investigated and rejected as unreliable): a fast, obvious manual
// retry for when a human notices a bad background, deliberately NOT an
// automated detection/regeneration loop. Reuses the source poster's own
// real headline/subhead/cta/aspectRatio/template — only the AI
// background itself is regenerated, as a genuinely new Poster row (this
// app has no "edit poster in place" concept anywhere else, and creating
// a new row keeps the original around rather than silently replacing
// it). Only meaningful for backgroundSource === "AI" — the caller
// (poster-form.tsx) only shows this action for AI-background posters,
// but this is re-checked here too since a Server Action is directly
// callable regardless of which UI state rendered its trigger.
export async function regeneratePosterBackground(
  _prevState: GeneratePosterState,
  formData: FormData,
): Promise<GeneratePosterState> {
  const { user, company } = await requireCompany();

  const posterId = formData.get("posterId");
  if (typeof posterId !== "string" || !posterId) {
    return { status: "error", error: "Missing poster." };
  }

  // Ownership check: only regenerate a poster that actually belongs to
  // the caller's company, same boundary every other company-scoped
  // query in this app enforces.
  const source = await db.poster.findFirst({ where: { id: posterId, companyId: company.id } });
  if (!source) {
    return { status: "error", error: "Poster not found." };
  }
  if (source.backgroundSource !== "AI") {
    return { status: "error", error: "Only AI-generated backgrounds can be regenerated this way." };
  }

  try {
    const result = await generatePosterCore({
      companyId: company.id,
      userId: user.id,
      headline: source.headline,
      subhead: source.subhead ?? undefined,
      cta: source.cta ?? undefined,
      aspectRatio: source.aspectRatio,
      template: source.template,
      backgroundSource: "AI",
    });
    return { status: "success", posterId: result.posterId, warnings: result.warnings, backgroundProviderName: result.backgroundProviderName, fallbackFrom: result.fallbackFrom };
  } catch (error) {
    if (error instanceof PosterGenerationError) {
      return { status: "error", error: error.message };
    }
    throw error;
  }
}

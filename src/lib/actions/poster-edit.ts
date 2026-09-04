"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requireCompany } from "@/lib/session";
import { getCompanyContext } from "@/lib/company-context";
import { getPickableMediaAssets } from "@/lib/media";
import { generatePosterCore, PosterGenerationError } from "@/lib/poster/generate";
import { DEFAULT_GRADIENT } from "@/lib/providers/image/gradient-provider";
import { getTextProviderForCompany } from "@/lib/providers/text/resolver";
import type { PosterEditSpec } from "@/lib/providers/text/types";
import type { FallbackInfo } from "@/lib/providers/fallback-log";

export type PosterEditState =
  | { status: "unavailable"; reason: string }
  | { status: "cannotApply"; explanation: string }
  | {
      status: "success";
      posterId: string;
      explanation: string;
      warnings: string[];
      // Real bug fix (2026-09-04): generatePosterCore already returns
      // these (poster.ts's two actions already forward them), but this
      // action was silently dropping them — so a real image-generation
      // fallback during an edit (e.g. the requested AI background
      // failing over to the brand gradient) never reached the user, who
      // just saw a plain "Updated." with no explanation for why the
      // background didn't match what they asked for.
      backgroundProviderName?: string;
      fallbackFrom?: FallbackInfo[];
    }
  | { status: "error"; error: string }
  | undefined;

const Schema = z.object({
  posterId: z.string().min(1),
  instruction: z.string().trim().min(3, "Describe what you'd like changed.").max(500),
});

// Natural-language poster editing (2026-09-03) — see PosterEditSpec's
// own doc comment (types.ts) for the real, honest scope this covers:
// template, text, colors, and image-slot changes only, never true
// freeform repositioning or pixel editing. Never edits in place — always
// creates a brand-new Poster row via generatePosterCore, linked back via
// parentPosterId/editInstruction (Poster's own schema comment), same
// "never mutate, always create new" convention regeneratePosterBackground
// already established.
export async function editPoster(_prevState: PosterEditState, formData: FormData): Promise<PosterEditState> {
  const { user, company } = await requireCompany();

  const parsed = Schema.safeParse({
    posterId: formData.get("posterId"),
    instruction: formData.get("instruction"),
  });
  if (!parsed.success) {
    return { status: "error", error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { posterId, instruction } = parsed.data;

  // Ownership check, same boundary every other company-scoped poster
  // action enforces.
  const source = await db.poster.findFirst({ where: { id: posterId, companyId: company.id } });
  if (!source) {
    return { status: "error", error: "Poster not found." };
  }

  const [context, brandKit, availablePhotos] = await Promise.all([
    getCompanyContext(company.id),
    db.brandKit.findUnique({ where: { companyId: company.id } }),
    getPickableMediaAssets(company.id, { includeVideo: false }),
  ]);

  const currentSpec: PosterEditSpec = {
    template: source.template,
    headline: source.headline,
    subhead: source.subhead,
    cta: source.cta,
    backgroundSource: source.backgroundSource,
    backgroundAssetId: source.backgroundAssetId,
    colors: {
      primary: source.overridePrimaryColor ?? brandKit?.primaryColor ?? DEFAULT_GRADIENT[0],
      secondary: source.overrideSecondaryColor ?? brandKit?.secondaryColor ?? DEFAULT_GRADIENT[1],
      accent: source.overrideAccentColor ?? brandKit?.accentColor ?? DEFAULT_GRADIENT[1],
    },
  };

  const textProvider = await getTextProviderForCompany(company.id);
  const result = await textProvider.editPosterSpec({
    context,
    currentSpec,
    instruction,
    availablePhotos: availablePhotos.map((p) => ({ id: p.id, fileName: p.fileName })),
  });

  if (!result.available) {
    return { status: "unavailable", reason: result.unavailableReason ?? "AI editing isn't available right now." };
  }
  if (!result.updatedSpec) {
    return { status: "cannotApply", explanation: result.explanation ?? "That isn't something this editor can do." };
  }

  const spec = result.updatedSpec;

  // Real, honest limitation (not a silent surprise): a poster's AI-
  // generated background is only ever stored as the final rendered PNG
  // (with text already baked in), never as a separate reusable layer —
  // so an edit that keeps backgroundSource "AI" without explicitly
  // requesting new imagery still triggers a genuinely fresh AI image
  // generation (real provider cost), not a silent no-op. Surfaced as a
  // real warning rather than hidden.
  const warnings: string[] = [];
  if (spec.backgroundSource === "AI" && source.backgroundSource === "AI" && !result.newImageRequest) {
    warnings.push(
      "This poster's AI background isn't stored separately from the finished image, so a new one was generated as part of this edit.",
    );
  }

  try {
    const genResult = await generatePosterCore({
      companyId: company.id,
      userId: user.id,
      headline: spec.headline,
      subhead: spec.subhead ?? undefined,
      cta: spec.cta ?? undefined,
      aspectRatio: source.aspectRatio,
      template: spec.template,
      backgroundSource: spec.backgroundSource,
      backgroundAssetId: spec.backgroundAssetId ?? undefined,
      colorOverrides: spec.colors,
      parentPosterId: source.id,
      editInstruction: instruction,
      backgroundTopicHint: result.newImageRequest ?? undefined,
      // Carried over unchanged — the edit spec has no concept of QR
      // codes at all, so an edit like "make the headline bigger"
      // shouldn't silently drop one the original poster had.
      qrCodeUrl: source.qrCodeUrl ?? undefined,
    });
    revalidatePath("/media");
    return {
      status: "success",
      posterId: genResult.posterId,
      explanation: result.explanation ?? "Updated.",
      warnings: [...warnings, ...genResult.warnings],
      backgroundProviderName: genResult.backgroundProviderName,
      fallbackFrom: genResult.fallbackFrom,
    };
  } catch (error) {
    if (error instanceof PosterGenerationError) {
      return { status: "error", error: error.message };
    }
    throw error;
  }
}

// Real edit history trail (Part 4.1) — walks parentPosterId back to the
// root, newest first, so the UI can show "what was asked and changed"
// for a given poster regardless of which version in the chain is
// currently being viewed.
export interface PosterEditHistoryEntry {
  posterId: string;
  headline: string;
  editInstruction: string | null;
  createdAt: Date;
}

export async function getPosterEditHistory(posterId: string): Promise<PosterEditHistoryEntry[]> {
  const { company } = await requireCompany();

  const chain: PosterEditHistoryEntry[] = [];
  let currentId: string | null = posterId;
  // Real, bounded walk (not unbounded recursion) — a poster's edit
  // chain is real user-driven data, not something that should ever
  // grow unbounded in one request; 50 versions of one poster is already
  // far beyond realistic use.
  for (let i = 0; i < 50 && currentId; i++) {
    const poster: { id: string; headline: string; editInstruction: string | null; createdAt: Date; parentPosterId: string | null } | null =
      await db.poster.findFirst({
        where: { id: currentId, companyId: company.id },
        select: { id: true, headline: true, editInstruction: true, createdAt: true, parentPosterId: true },
      });
    if (!poster) break;
    chain.push({ posterId: poster.id, headline: poster.headline, editInstruction: poster.editInstruction, createdAt: poster.createdAt });
    currentId = poster.parentPosterId;
  }
  return chain;
}

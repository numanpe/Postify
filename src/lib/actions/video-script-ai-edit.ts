"use server";

import { z } from "zod";

import { db } from "@/lib/db";
import { requireCompany } from "@/lib/session";
import { getCompanyContext } from "@/lib/company-context";
import { getTextProviderForCompany } from "@/lib/providers/text/resolver";
import type { VideoScriptSections } from "@/lib/providers/text/types";

// AI-powered script editing (2026-09-06) — a real suggestion step, NOT
// an apply step. Reuses the exact structured-edit + honest-mismatch
// pattern editPoster (poster-edit.ts) established: the AI proposes a
// new script; this action only returns that proposal for the client to
// show as a before/after. Applying it re-uses the EXISTING manual
// script editor's own save path (editVideoScript, video-edit.ts) —
// this is a new INPUT method into that same system, not a parallel
// pipeline, per this feature's own scope (see EditVideoScriptInput's
// doc comment, providers/text/types.ts). Never persists or re-renders
// anything itself.
export type SuggestVideoScriptEditState =
  | { status: "unavailable"; reason: string }
  | { status: "cannotApply"; explanation: string }
  | { status: "success"; updatedScript: VideoScriptSections; explanation: string }
  | { status: "error"; error: string }
  | undefined;

const Schema = z.object({
  videoId: z.string().min(1),
  instruction: z.string().trim().min(3, "Describe what you'd like changed.").max(500),
});

export async function suggestVideoScriptEdit(
  _prevState: SuggestVideoScriptEditState,
  formData: FormData,
): Promise<SuggestVideoScriptEditState> {
  const { company } = await requireCompany();

  const parsed = Schema.safeParse({
    videoId: formData.get("videoId"),
    instruction: formData.get("instruction"),
  });
  if (!parsed.success) {
    return { status: "error", error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { videoId, instruction } = parsed.data;

  const video = await db.video.findFirst({
    where: { id: videoId, companyId: company.id },
    select: { script: true, hasNarration: true },
  });
  if (!video) {
    return { status: "error", error: "This video no longer exists." };
  }
  // Scope boundary (see EditVideoScriptInput's own doc comment): a
  // non-narrated video has no single 5-section script a user edits
  // directly — only per-scene on-screen text, a different editor with
  // no AI-suggestion counterpart in this pass.
  if (!video.hasNarration) {
    return { status: "error", error: "AI script suggestions are only available for narrated videos." };
  }

  const context = await getCompanyContext(company.id);
  const textProvider = await getTextProviderForCompany(company.id);
  const result = await textProvider.editVideoScriptSpec({
    context,
    currentScript: video.script as unknown as VideoScriptSections,
    instruction,
  });

  if (!result.available) {
    return { status: "unavailable", reason: result.unavailableReason ?? "AI editing isn't available right now." };
  }
  if (!result.updatedScript) {
    return { status: "cannotApply", explanation: result.explanation ?? "That isn't something this editor can do." };
  }

  return { status: "success", updatedScript: result.updatedScript, explanation: result.explanation ?? "Updated." };
}

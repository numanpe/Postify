"use server";

import { revalidatePath } from "next/cache";

import type { SignalSource } from "@prisma/client";

import { db } from "@/lib/db";
import { requireCompany } from "@/lib/session";
import { createMediaAssetFromFile, MAX_FILE_SIZE_BYTES } from "@/lib/media";
import { recordSignal, SIGNAL_STRENGTH } from "@/lib/creative-dna/signals";
import { recomputeCreativeDnaPreferences } from "@/lib/creative-dna/aggregate";

export type TeachDirection = Extract<SignalSource, "LIKE" | "DISLIKE">;

// Part 2's real explicit-signal INPUT into the exact same weighting
// system delete/publish/edit/regenerate already feed (see signals.ts's
// SIGNAL_STRENGTH — LIKE/DISLIKE were reserved there, unused, for
// exactly this: "the strongest explicit signals for whenever a rating
// control is built, so it plugs into this same system instead of a
// second one"). Not a new learning system — recordSignal +
// recomputeCreativeDnaPreferences are the same functions delete/
// publish/edit/regenerate already call. Reuses the same topic/
// template/visualStyle sourcing as the real DELETE handler
// (actions/media.ts) so an explicit like and an implicit delete
// describe the same content the same way.
export async function markContentSignal(input: {
  posterId?: string;
  videoId?: string;
  direction: TeachDirection;
}): Promise<{ error: string } | { success: true }> {
  const { company } = await requireCompany();
  const { posterId, videoId, direction } = input;

  if (!posterId && !videoId) return { error: "Nothing to mark." };

  const [poster, video] = await Promise.all([
    posterId
      ? db.poster.findFirst({
          where: { id: posterId, companyId: company.id },
          include: { campaignItem: { include: { campaign: true } } },
        })
      : null,
    videoId
      ? db.video.findFirst({
          where: { id: videoId, companyId: company.id },
          include: { campaignItem: { include: { campaign: true } } },
        })
      : null,
  ]);

  if (!poster && !video) return { error: "That content wasn't found." };

  const campaignItem = poster?.campaignItem ?? video?.campaignItem;

  await recordSignal({
    companyId: company.id,
    sourceType: direction,
    strength: SIGNAL_STRENGTH[direction],
    topic: campaignItem?.campaign.campaignType,
    template: poster?.template ?? video?.template,
    visualStyle: poster?.backgroundSource,
    posterId: poster?.id,
    videoId: video?.id,
    campaignItemId: campaignItem?.id,
  });

  await recomputeCreativeDnaPreferences(company.id);
  revalidatePath("/settings");
  return { success: true };
}

export type TeachExampleState = { error: string } | undefined;

// Real limitation, disclosed rather than faked: this app has no vision
// provider anywhere (MediaAsset's own Phase 1 schema comment: auto-
// tagging is structural metadata only, confirmed by a full audit
// before that comment was written). An uploaded external example can't
// be automatically analyzed, so the user tells us directly what it
// represents — an honest manual tag, never a pretend AI read of the
// image. Stored as a real MediaAsset (same upload path as the Media
// Library) plus a CreativeSignal referencing it, not a separate,
// parallel table — CLAUDE.md's "don't over-engineer" rule.
export async function submitTeachExample(
  _prevState: TeachExampleState,
  formData: FormData,
): Promise<TeachExampleState> {
  const { user, company } = await requireCompany();

  const file = formData.get("file");
  const topic = String(formData.get("topic") ?? "").trim();
  const visualStyle = String(formData.get("visualStyle") ?? "").trim();
  const direction: TeachDirection = formData.get("direction") === "DISLIKE" ? "DISLIKE" : "LIKE";

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a photo or video to upload." };
  }
  if (!topic && !visualStyle) {
    return { error: "Tell us what this example represents — a topic, a visual style, or both." };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { error: "That file is too large — the limit is 25MB." };
  }
  if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
    return { error: "Only photos or videos are supported as examples." };
  }

  const asset = await createMediaAssetFromFile({ companyId: company.id, uploadedById: user.id, file });

  await recordSignal({
    companyId: company.id,
    sourceType: direction,
    strength: SIGNAL_STRENGTH[direction],
    topic: topic || undefined,
    visualStyle: visualStyle || undefined,
    metadata: { teachExampleMediaAssetId: asset.id },
  });

  await recomputeCreativeDnaPreferences(company.id);
  revalidatePath("/settings");
}

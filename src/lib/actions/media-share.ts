"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requireCompany } from "@/lib/session";
import { createPublishJob } from "@/lib/actions/publish";
import { publishStandaloneAssetViaAggregatorForCompany } from "@/lib/actions/campaign-publish-core";
import type { SocialPlatform } from "@prisma/client";

export type ShareAssetState = { error: string } | { success: true; message: string } | undefined;

const ShareAssetSchema = z
  .object({
    targetKey: z.string().min(1, "Choose an account to share to."),
    posterId: z.string().min(1).nullish(),
    videoId: z.string().min(1).nullish(),
    caption: z.string().trim().min(1, "Write a caption.").max(2200, "Keep the caption under 2200 characters."),
    scheduledFor: z.string().optional(),
  })
  .refine((data) => Boolean(data.posterId) !== Boolean(data.videoId), {
    message: "Choose exactly one poster or video to share.",
  });

// Media Library's "Share" button (2026-09-02) — a new entry point into
// the app's two EXISTING publish systems, not a new one. targetKey
// (from getRealPublishTargets, publish-targets.ts) encodes which system
// this share actually goes through:
//   "direct:<socialAccountId>"  -> delegates straight to createPublishJob
//                                   (publish.ts), completely unchanged —
//                                   same PublishJob row, same immediate-
//                                   vs-scheduled handling, same cron.
//   "aggregator:<SocialPlatform>" -> publishStandaloneAssetViaAggregatorForCompany
//                                   (campaign-publish-core.ts), the same
//                                   real aggregator adapter call the
//                                   campaign card's "Publish via Selected
//                                   Provider" button already makes, just
//                                   for a bare Poster/Video instead of a
//                                   CampaignItem.
export async function shareGeneratedAsset(
  _prevState: ShareAssetState,
  formData: FormData,
): Promise<ShareAssetState> {
  const { company } = await requireCompany();

  const parsed = ShareAssetSchema.safeParse({
    targetKey: formData.get("targetKey"),
    posterId: formData.get("posterId") || undefined,
    videoId: formData.get("videoId") || undefined,
    caption: formData.get("caption"),
    scheduledFor: formData.get("scheduledFor") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { targetKey, posterId, videoId, caption, scheduledFor } = parsed.data;

  const [via, rest] = targetKey.split(":", 2);

  if (via === "direct") {
    const directFormData = new FormData();
    directFormData.set("socialAccountId", rest);
    if (posterId) directFormData.set("posterId", posterId);
    if (videoId) directFormData.set("videoId", videoId);
    directFormData.set("caption", caption);
    if (scheduledFor) directFormData.set("scheduledFor", scheduledFor);

    const result = await createPublishJob(undefined, directFormData);
    if (result?.error) {
      return { error: result.error };
    }
    revalidatePath("/media");
    return {
      success: true,
      message: scheduledFor ? "Scheduled to publish." : "Published now.",
    };
  }

  if (via === "aggregator") {
    // Real ownership check + hashtags/target-platform pre-fill from a
    // linked CampaignItem when one exists — a standalone Studio item
    // (no CampaignItem) just gets an empty hashtag list, same honest
    // "nothing to pre-fill" behavior createPublishJob's own caption
    // field already has for non-campaign items.
    const [poster, video] = await Promise.all([
      posterId
        ? db.poster.findFirst({
            where: { id: posterId, companyId: company.id },
            include: { campaignItem: true },
          })
        : null,
      videoId
        ? db.video.findFirst({
            where: { id: videoId, companyId: company.id },
            include: { campaignItem: true },
          })
        : null,
    ]);
    if ((posterId && !poster) || (videoId && !video)) {
      return { error: "That poster or video no longer exists." };
    }
    const hashtags = poster?.campaignItem?.hashtags ?? video?.campaignItem?.hashtags ?? [];

    let scheduledTime: Date | undefined;
    if (scheduledFor) {
      const parsedDate = new Date(scheduledFor);
      if (Number.isNaN(parsedDate.getTime())) {
        return { error: "Pick a valid date and time." };
      }
      if (parsedDate > new Date()) {
        scheduledTime = parsedDate;
      }
    }

    const result = await publishStandaloneAssetViaAggregatorForCompany({
      company,
      posterId: posterId ?? undefined,
      videoId: videoId ?? undefined,
      captionText: caption,
      hashtags,
      targetPlatforms: [rest as SocialPlatform],
      scheduledTime,
    });

    if (!result.succeeded) {
      return { error: result.errorMessage ?? "Publish failed." };
    }
    revalidatePath("/media");
    return {
      success: true,
      message: scheduledTime ? "Scheduled to publish." : "Published now.",
    };
  }

  return { error: "Invalid share target." };
}

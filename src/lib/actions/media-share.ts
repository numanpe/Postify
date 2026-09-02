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
    // Part 3's real optional trending-audio pick (Instagram Reels via
    // Zernio only) — see AggregatorPostInput.instagramAudioId's own doc
    // comment. Silently ignored for any other target; never required.
    instagramAudioId: z.string().min(1).optional(),
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
//   "aggregator:<SocialPlatform>" -> Upload-Post's single-profile shape
//                                   only (see AggregatorCredential.
//                                   accountMap's own doc comment) ->
//                                   publishStandaloneAssetViaAggregatorForCompany.
//   "aggregator-account:<id>"     -> a specific real AggregatorAccount
//                                   (2026-09-03 multi-account redesign)
//                                   -> publishStandaloneAssetViaAggregatorForCompany,
//                                   the same real aggregator adapter call
//                                   the campaign card's "Publish via
//                                   Selected Provider" button already
//                                   makes, just for a bare Poster/Video
//                                   instead of a CampaignItem.
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
    instagramAudioId: formData.get("instagramAudioId") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { targetKey, posterId, videoId, caption, scheduledFor, instagramAudioId } = parsed.data;

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

  if (via === "aggregator" || via === "aggregator-account") {
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

    // "aggregator-account" targets a specific real AggregatorAccount
    // (2026-09-03 multi-account redesign) — company-scoped via the
    // credential join, same multi-tenant isolation every other lookup
    // here uses. "aggregator" is Upload-Post's single-profile shape,
    // unchanged: rest is a bare SocialPlatform.
    let targetPlatform: SocialPlatform;
    let accountIds: string[] | undefined;
    if (via === "aggregator-account") {
      const account = await db.aggregatorAccount.findFirst({
        where: { id: rest, credential: { companyId: company.id } },
      });
      if (!account) {
        return { error: "That connected account no longer exists." };
      }
      targetPlatform = account.platform;
      accountIds = [account.id];
    } else {
      targetPlatform = rest as SocialPlatform;
    }

    const result = await publishStandaloneAssetViaAggregatorForCompany({
      company,
      posterId: posterId ?? undefined,
      videoId: videoId ?? undefined,
      captionText: caption,
      hashtags,
      targetPlatforms: [targetPlatform],
      accountIds,
      scheduledTime,
      // Only ever meaningful for an "INSTAGRAM" aggregator target — sent
      // regardless (attemptAggregatorPublish/the adapter both already
      // ignore it for any other platform), same "pass through, let the
      // real layer decide relevance" pattern scheduledTime already uses.
      instagramAudioId: targetPlatform === "INSTAGRAM" ? instagramAudioId : undefined,
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

"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requireCompany } from "@/lib/session";
import { processPublishJobs, processSinglePublishJob } from "@/lib/jobs/process-publish-jobs";
import { cleanupMediaStorage } from "@/lib/storage-cleanup";
import { suggestPeakPublishTime, formatForDatetimeLocalInput } from "@/lib/scheduling/smart-scheduler";
import { isVideoOnlyPlatform } from "@/lib/providers/social/platform-status";
import { recordSignal, SIGNAL_STRENGTH } from "@/lib/creative-dna/signals";
import { recomputeCreativeDnaPreferences } from "@/lib/creative-dna/aggregate";
import { summarizeCaptionEdit } from "@/lib/creative-dna/edit-diff";

export type CreatePublishJobState = { error: string } | undefined;

const CreatePublishJobSchema = z
  .object({
    socialAccountId: z.string().min(1, "Choose an account to publish to."),
    // Prisma's schema can't express "exactly one of posterId/videoId" —
    // validated below via .refine() instead.
    posterId: z.string().min(1).nullish(),
    videoId: z.string().min(1).nullish(),
    caption: z.string().trim().min(1, "Write a caption.").max(2200, "Keep the caption under 2200 characters."),
    // Empty string means "publish now" — <input type="datetime-local">
    // submits local wall-clock time with no timezone, so this is parsed
    // as local time deliberately (unlike the UTC-safe date-only math in
    // campaign scheduling, which has no time-of-day component to lose).
    scheduledFor: z.string().optional(),
  })
  .refine((data) => Boolean(data.posterId) !== Boolean(data.videoId), {
    message: "Choose exactly one poster or video to publish.",
  });

export async function createPublishJob(
  _prevState: CreatePublishJobState,
  formData: FormData,
): Promise<CreatePublishJobState> {
  const { company } = await requireCompany();

  const parsed = CreatePublishJobSchema.safeParse({
    socialAccountId: formData.get("socialAccountId"),
    posterId: formData.get("posterId") || undefined,
    videoId: formData.get("videoId") || undefined,
    caption: formData.get("caption"),
    scheduledFor: formData.get("scheduledFor") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { socialAccountId, posterId, videoId, caption, scheduledFor } = parsed.data;

  // Ownership checks: never trust the client-supplied IDs — the
  // account and the poster/video must actually belong to the caller's
  // company.
  const [account, poster, video] = await Promise.all([
    db.socialAccount.findFirst({ where: { id: socialAccountId, companyId: company.id } }),
    posterId
      ? db.poster.findFirst({
          where: { id: posterId, companyId: company.id },
          include: { campaignItem: { include: { campaign: true } } },
        })
      : null,
    videoId ? db.video.findFirst({ where: { id: videoId, companyId: company.id } }) : null,
  ]);
  if (!account) {
    return { error: "That connected account no longer exists." };
  }
  if (posterId && !poster) {
    return { error: "That poster no longer exists." };
  }
  if (videoId && !video) {
    return { error: "That video no longer exists." };
  }

  const videoOnly = isVideoOnlyPlatform(account.platform);
  if (videoOnly && !video) {
    return { error: `${account.platform} only supports publishing a video, not a poster.` };
  }
  if (!videoOnly && video) {
    return { error: `${account.platform} doesn't support publishing a video yet — choose a poster instead.` };
  }

  let scheduledDate = new Date();
  if (scheduledFor) {
    const parsedDate = new Date(scheduledFor);
    if (Number.isNaN(parsedDate.getTime())) {
      return { error: "Pick a valid date and time." };
    }
    scheduledDate = parsedDate;
  }

  // Part 4.1's real edit-diff signal — only meaningful for posters,
  // where CreatePublishJobForm pre-fills the caption from the poster's
  // own real generated headline/subhead/cta (this recomputes that exact
  // same join server-side, rather than trusting a client-supplied
  // "was this edited" flag). Videos have no equivalent original text to
  // diff against here.
  let recordedEdit = false;
  if (poster) {
    const originalCaption = [poster.headline, poster.subhead, poster.cta].filter(Boolean).join("\n\n");
    const diff = summarizeCaptionEdit(originalCaption, caption);
    if (diff) {
      await recordSignal({
        companyId: company.id,
        sourceType: "EDIT",
        strength: SIGNAL_STRENGTH.EDIT,
        topic: poster.campaignItem?.campaign.campaignType,
        template: poster.template,
        posterId: poster.id,
        metadata: { ...diff },
      });
      recordedEdit = true;
    }
  }

  const job = await db.publishJob.create({
    data: {
      companyId: company.id,
      socialAccountId: account.id,
      posterId: poster?.id,
      videoId: video?.id,
      caption,
      status: "SCHEDULED",
      scheduledFor: scheduledDate,
      nextAttemptAt: scheduledDate,
    },
    include: {
      socialAccount: true,
      poster: { include: { asset: true, campaignItem: { include: { campaign: true } } } },
      video: { include: { asset: true, campaignItem: { include: { campaign: true } } } },
    },
  });

  if (recordedEdit) {
    await recomputeCreativeDnaPreferences(company.id);
  }

  // "Now" means now: a real, awaited publish attempt within this same
  // request, exactly like the campaign card's Direct/Aggregator publish
  // buttons (campaign-publish.ts) — not the old fire-and-forget
  // triggerPublishProcessing(), which trigger.ts's own doc comment
  // already flags as a best-effort optimization Vercel's serverless
  // runtime can freeze before it finishes. That left a real gap: a job
  // created with an empty "publish at" field could silently sit
  // SCHEDULED until the once-daily cron or a manual "Process now" click,
  // even though the user asked for it to go out immediately.
  if (scheduledDate <= new Date()) {
    const outcome = await processSinglePublishJob(job);
    const assetId = job.poster?.asset.id ?? job.video?.asset.id;
    if (outcome === "succeeded" && assetId) {
      await cleanupMediaStorage(assetId);
    }
    // Real bug found live via the Media Library Share button (2026-09-02):
    // this "now" path used to fall through to `undefined` regardless of
    // outcome, so a synchronous publish that actually failed (e.g. a bad
    // token) was indistinguishable from success — media-share.ts's caller
    // took the absence of `.error` as "Published now." and told the user
    // so, while Recent Activity simultaneously showed the real failure.
    // /publish's own form already renders `state.error` (see
    // create-publish-job-form.tsx), it just never had a failure to show.
    if (outcome === "failed") {
      const failed = await db.publishJob.findUnique({ where: { id: job.id }, select: { errorMessage: true } });
      revalidatePath("/publish");
      return { error: failed?.errorMessage ?? "Publish failed." };
    }
  }

  revalidatePath("/publish");
}

async function requireOwnedPublishJob(jobId: string, companyId: string) {
  const job = await db.publishJob.findFirst({ where: { id: jobId, companyId } });
  if (!job) {
    throw new Error("Publish job not found.");
  }
  return job;
}

export async function retryPublishJob(jobId: string): Promise<void> {
  const { company } = await requireCompany();
  const job = await requireOwnedPublishJob(jobId, company.id);

  if (job.status !== "FAILED") return;

  // Same real, awaited retry as createPublishJob's "now" path above —
  // a user clicking Retry expects it to actually retry, not wait for
  // the next cron tick or a separate manual "Process now" click.
  const updated = await db.publishJob.update({
    where: { id: job.id },
    data: { status: "SCHEDULED", retryCount: 0, nextAttemptAt: new Date(), errorMessage: null },
    include: {
      socialAccount: true,
      poster: { include: { asset: true, campaignItem: { include: { campaign: true } } } },
      video: { include: { asset: true, campaignItem: { include: { campaign: true } } } },
    },
  });

  const outcome = await processSinglePublishJob(updated);
  const assetId = updated.poster?.asset.id ?? updated.video?.asset.id;
  if (outcome === "succeeded" && assetId) {
    await cleanupMediaStorage(assetId);
  }

  revalidatePath("/publish");
}

export async function cancelPublishJob(jobId: string): Promise<void> {
  const { company } = await requireCompany();
  const job = await requireOwnedPublishJob(jobId, company.id);

  if (job.status === "PUBLISHED" || job.status === "PUBLISHING") return;

  await db.publishJob.delete({ where: { id: job.id } });
  revalidatePath("/publish");
}

export async function disconnectSocialAccount(accountId: string): Promise<void> {
  const { company } = await requireCompany();

  // Ownership check: only remove an account that actually belongs to
  // the caller's company.
  await db.socialAccount.deleteMany({ where: { id: accountId, companyId: company.id } });
  revalidatePath("/publish");
}

// Synchronous, user-triggered batch processing — the actual
// verification/demo path in an environment without a real external
// scheduler wired up. Not scoped to a single company (it processes
// whatever's globally due), same known scaling limit as
// processCampaignNow in src/lib/actions/campaign.ts.
export async function processPublishJobsNow(): Promise<void> {
  await requireCompany();
  await processPublishJobs(20);
  revalidatePath("/publish");
}

export interface SuggestedScheduleResult {
  value: string; // ready to assign straight to a datetime-local input
  source: "learned" | "default";
  sampleSize?: number;
}

// Called directly from CreatePublishJobForm's "Auto-Schedule Peak
// Time" button (a plain async server function, not a form action —
// valid to call straight from a client component's onClick). Task 5's
// smart scheduler: the company's own real measured peak engagement
// hour once there's enough evidence for it, otherwise the UAE/GCC
// default (12-2pm / 7-9pm GST) — see smart-scheduler.ts for the real
// statistical-caution threshold.
export async function suggestPublishTime(): Promise<SuggestedScheduleResult> {
  const { company } = await requireCompany();
  const suggestion = await suggestPeakPublishTime(company.id);
  return {
    value: formatForDatetimeLocalInput(suggestion.scheduledFor),
    source: suggestion.source,
    sampleSize: suggestion.sampleSize,
  };
}

"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requireCompany } from "@/lib/session";
import { processPublishJobs } from "@/lib/jobs/process-publish-jobs";
import { triggerPublishProcessing } from "@/lib/jobs/trigger";
import { suggestPeakPublishTime, formatForDatetimeLocalInput } from "@/lib/scheduling/smart-scheduler";

export type CreatePublishJobState = { error: string } | undefined;

const CreatePublishJobSchema = z.object({
  socialAccountId: z.string().min(1, "Choose an account to publish to."),
  posterId: z.string().min(1, "Choose a poster to publish."),
  caption: z.string().trim().min(1, "Write a caption.").max(2200, "Keep the caption under 2200 characters."),
  // Empty string means "publish now" — <input type="datetime-local">
  // submits local wall-clock time with no timezone, so this is parsed
  // as local time deliberately (unlike the UTC-safe date-only math in
  // campaign scheduling, which has no time-of-day component to lose).
  scheduledFor: z.string().optional(),
});

export async function createPublishJob(
  _prevState: CreatePublishJobState,
  formData: FormData,
): Promise<CreatePublishJobState> {
  const { company } = await requireCompany();

  const parsed = CreatePublishJobSchema.safeParse({
    socialAccountId: formData.get("socialAccountId"),
    posterId: formData.get("posterId"),
    caption: formData.get("caption"),
    scheduledFor: formData.get("scheduledFor") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { socialAccountId, posterId, caption, scheduledFor } = parsed.data;

  // Ownership checks: never trust the client-supplied IDs — both the
  // account and the poster must actually belong to the caller's company.
  const [account, poster] = await Promise.all([
    db.socialAccount.findFirst({ where: { id: socialAccountId, companyId: company.id } }),
    db.poster.findFirst({ where: { id: posterId, companyId: company.id } }),
  ]);
  if (!account) {
    return { error: "That connected account no longer exists." };
  }
  if (!poster) {
    return { error: "That poster no longer exists." };
  }

  let scheduledDate = new Date();
  if (scheduledFor) {
    const parsedDate = new Date(scheduledFor);
    if (Number.isNaN(parsedDate.getTime())) {
      return { error: "Pick a valid date and time." };
    }
    scheduledDate = parsedDate;
  }

  await db.publishJob.create({
    data: {
      companyId: company.id,
      socialAccountId: account.id,
      posterId: poster.id,
      caption,
      status: "SCHEDULED",
      scheduledFor: scheduledDate,
      nextAttemptAt: scheduledDate,
    },
  });

  if (scheduledDate <= new Date()) {
    triggerPublishProcessing();
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

  await db.publishJob.update({
    where: { id: job.id },
    data: { status: "SCHEDULED", retryCount: 0, nextAttemptAt: new Date(), errorMessage: null },
  });

  triggerPublishProcessing();
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

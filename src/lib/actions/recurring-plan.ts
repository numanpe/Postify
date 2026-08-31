"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import type { SocialPlatform } from "@prisma/client";

import { db } from "@/lib/db";
import { requireCompany } from "@/lib/session";

// Mirrors process-recurring-plans.ts's own MAX_ITEMS_PER_DAY — kept in
// sync by hand (small, stable constant) rather than a shared import, so
// this "use server" actions file and that plain server-only job module
// stay independently readable.
const MAX_ITEMS_PER_DAY = 10;
const MAX_PUBLISH_TIMES = 4;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export type SaveRecurringPlanState = { error: string } | { success: true } | undefined;

const SaveRecurringPlanSchema = z
  .object({
    postsPerDay: z.coerce.number().int().min(0).max(MAX_ITEMS_PER_DAY),
    videosPerDay: z.coerce.number().int().min(0).max(MAX_ITEMS_PER_DAY),
    publishTimes: z
      .string()
      .trim()
      .transform((value) =>
        value
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      ),
    targetPlatforms: z.array(z.string()).default([]),
    objectiveHint: z
      .string()
      .trim()
      .max(200, "Keep the topic hint under 200 characters.")
      .nullish()
      .transform((value) => value || null),
    autoPublish: z
      .string()
      .nullish()
      .transform((value) => value === "true"),
  })
  .refine((data) => data.postsPerDay + data.videosPerDay >= 1, {
    message: "Generate at least 1 post or video per day.",
  })
  .refine((data) => data.postsPerDay + data.videosPerDay <= MAX_ITEMS_PER_DAY, {
    message: `Up to ${MAX_ITEMS_PER_DAY} items per day.`,
  })
  .refine((data) => data.publishTimes.length <= MAX_PUBLISH_TIMES, {
    message: `Up to ${MAX_PUBLISH_TIMES} publish times.`,
  })
  .refine((data) => data.publishTimes.every((t) => TIME_PATTERN.test(t)), {
    message: "Publish times must be 24-hour HH:mm, e.g. 09:00.",
  });

export async function saveRecurringPlan(
  _prevState: SaveRecurringPlanState,
  formData: FormData,
): Promise<SaveRecurringPlanState> {
  const { company } = await requireCompany();

  const parsed = SaveRecurringPlanSchema.safeParse({
    postsPerDay: formData.get("postsPerDay"),
    videosPerDay: formData.get("videosPerDay"),
    publishTimes: formData.get("publishTimes") ?? "",
    targetPlatforms: formData.getAll("targetPlatforms"),
    objectiveHint: formData.get("objectiveHint"),
    autoPublish: formData.get("autoPublish"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { postsPerDay, videosPerDay, publishTimes, targetPlatforms, objectiveHint, autoPublish } = parsed.data;

  // Never trust the client's own disabling of the auto-publish checkbox
  // — re-verify server-side that a real publishing method is actually
  // connected before allowing auto-publish on.
  if (autoPublish) {
    const canAutoPublish = await companyHasRealPublishingMethod(company.id);
    if (!canAutoPublish) {
      return { error: "Connect a publishing method (Settings → Publishing) before turning on auto-publish." };
    }
  }

  const connectedPlatforms = await db.socialAccount.findMany({
    where: { companyId: company.id },
    select: { platform: true },
    distinct: ["platform"],
  });
  const connectedSet = new Set(connectedPlatforms.map((a) => a.platform));
  const validPlatforms = targetPlatforms.filter((p): p is SocialPlatform => connectedSet.has(p as SocialPlatform));

  await db.recurringPlan.upsert({
    where: { companyId: company.id },
    create: {
      companyId: company.id,
      postsPerDay,
      videosPerDay,
      publishTimes,
      targetPlatforms: validPlatforms,
      objectiveHint,
      autoPublish,
    },
    update: {
      postsPerDay,
      videosPerDay,
      publishTimes,
      targetPlatforms: validPlatforms,
      objectiveHint,
      autoPublish,
    },
  });

  revalidatePath("/campaigns/recurring");
  return { success: true };
}

export async function companyHasRealPublishingMethod(companyId: string): Promise<boolean> {
  const company = await db.company.findUniqueOrThrow({
    where: { id: companyId },
    select: { publishingMode: true, selectedAggregator: true },
  });
  if (company.publishingMode === "AGGREGATOR" && company.selectedAggregator) {
    const credential = await db.aggregatorCredential.findUnique({
      where: { companyId_provider: { companyId, provider: company.selectedAggregator } },
    });
    return !!credential;
  }
  if (company.publishingMode === "DIRECT_API") {
    const account = await db.socialAccount.findFirst({ where: { companyId } });
    return !!account;
  }
  return false;
}

export async function setRecurringPlanPaused(isPaused: boolean): Promise<void> {
  const { company } = await requireCompany();

  await db.recurringPlan.updateMany({
    where: { companyId: company.id },
    data: { isPaused },
  });

  revalidatePath("/campaigns/recurring");
}

export async function deleteRecurringPlan(): Promise<void> {
  const { company } = await requireCompany();

  // Never cascades to the real Campaign/CampaignItem rows this rule
  // already generated (Campaign.recurringPlanId is SetNull, not
  // Cascade) — deleting the rule only stops future runs.
  await db.recurringPlan.deleteMany({ where: { companyId: company.id } });

  revalidatePath("/campaigns/recurring");
}

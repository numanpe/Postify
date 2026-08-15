"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { requireCompany } from "@/lib/session";
import { getCompanyContext } from "@/lib/company-context";
import { getTextProviderForCompany } from "@/lib/providers/text/resolver";
import { ProviderError } from "@/lib/providers/text/types";
import { processCampaignItems } from "@/lib/jobs/process-campaign-items";
import { triggerCampaignProcessing } from "@/lib/jobs/trigger";

export type CreateCampaignState = { error: string } | undefined;

const CreateCampaignSchema = z.object({
  objective: z
    .string()
    .trim()
    .min(3, "Describe the campaign's objective.")
    .max(200, "Keep the objective under 200 characters."),
  startDate: z.string().refine((value) => !Number.isNaN(Date.parse(value)), "Pick a valid start date."),
  days: z.coerce.number().int().min(1, "At least 1 day.").max(14, "Up to 14 days at a time."),
});

export async function createCampaign(
  _prevState: CreateCampaignState,
  formData: FormData,
): Promise<CreateCampaignState> {
  const { company } = await requireCompany();

  const parsed = CreateCampaignSchema.safeParse({
    objective: formData.get("objective"),
    startDate: formData.get("startDate"),
    days: formData.get("days"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { objective, startDate, days } = parsed.data;

  const context = await getCompanyContext(company.id);
  const textProvider = await getTextProviderForCompany(company.id);

  let angles: string[];
  try {
    const plan = await textProvider.generateCampaignPlan({ context, objective, itemCount: days });
    angles = plan.angles;
  } catch (error) {
    if (error instanceof ProviderError) {
      return { error: `${error.providerName}: ${error.message}` };
    }
    throw error;
  }

  // <input type="date"> submits "YYYY-MM-DD", which Date parses as UTC
  // midnight — advancing with setUTCDate (not the local-time setDate)
  // keeps this consistent with the calendar grid's date math
  // (src/lib/campaign-calendar.ts) regardless of server timezone.
  const start = new Date(startDate);
  const campaign = await db.campaign.create({
    data: {
      companyId: company.id,
      name: objective.length > 60 ? `${objective.slice(0, 57)}...` : objective,
      objective,
      items: {
        create: angles.map((angle, index) => {
          const scheduledDate = new Date(start);
          scheduledDate.setUTCDate(scheduledDate.getUTCDate() + index);
          return { scheduledDate, angle };
        }),
      },
    },
  });

  // Best-effort head start — see trigger.ts for why this isn't a
  // delivery guarantee on serverless hosts.
  triggerCampaignProcessing();

  revalidatePath("/campaigns");
  redirect(`/campaigns/${campaign.id}`);
}

async function requireOwnedCampaignItem(itemId: string, companyId: string) {
  const item = await db.campaignItem.findFirst({
    where: { id: itemId, campaign: { companyId } },
  });
  if (!item) {
    throw new Error("Campaign item not found.");
  }
  return item;
}

export async function approveCampaignItem(itemId: string): Promise<void> {
  const { company } = await requireCompany();
  const item = await requireOwnedCampaignItem(itemId, company.id);

  if (item.status === "READY") {
    await db.campaignItem.update({ where: { id: item.id }, data: { status: "APPROVED" } });
  }

  revalidatePath(`/campaigns/${item.campaignId}`);
}

// Covers both "retry a permanently-failed item" and "regenerate with a
// newly edited angle" — both just mean "generate this item again from
// scratch." Bound as `.bind(null, itemId)` on a <form>, so the trailing
// argument is always the form's FormData (React's calling convention
// for bound form actions) — an empty/missing "angle" field means a
// plain retry with the existing text.
export async function regenerateCampaignItem(itemId: string, formData: FormData): Promise<void> {
  const { company } = await requireCompany();
  const item = await requireOwnedCampaignItem(itemId, company.id);

  const newAngle = formData.get("angle");
  const trimmed = typeof newAngle === "string" ? newAngle.trim() : "";

  await db.campaignItem.update({
    where: { id: item.id },
    data: {
      angle: trimmed ? trimmed : item.angle,
      status: "PENDING",
      retryCount: 0,
      nextAttemptAt: new Date(),
      errorMessage: null,
    },
  });

  triggerCampaignProcessing();
  revalidatePath(`/campaigns/${item.campaignId}`);
}

export async function removeCampaignItem(itemId: string): Promise<void> {
  const { company } = await requireCompany();
  const item = await requireOwnedCampaignItem(itemId, company.id);

  await db.campaignItem.delete({ where: { id: item.id } });
  revalidatePath(`/campaigns/${item.campaignId}`);
}

// Synchronous, user-triggered batch processing — the actual
// verification/demo path in an environment without a real external
// scheduler wired up. Not scoped to a single campaign (it processes
// whatever's globally due), so in a multi-company deployment another
// company's queued items could be picked up in the same batch; fine at
// this app's current scale, called out as a known scaling limit rather
// than engineered around prematurely.
export async function processCampaignNow(campaignId: string): Promise<void> {
  const { company } = await requireCompany();
  const campaign = await db.campaign.findFirst({ where: { id: campaignId, companyId: company.id } });
  if (!campaign) return;

  await processCampaignItems(20);
  revalidatePath(`/campaigns/${campaignId}`);
}

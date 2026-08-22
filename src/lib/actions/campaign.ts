"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { requireCompany } from "@/lib/session";
import { getCompanyContext } from "@/lib/company-context";
import { getTextProviderForCompany } from "@/lib/providers/text/resolver";
import { ProviderError } from "@/lib/providers/text/types";
import { processCampaignItems, processSingleCampaignItem } from "@/lib/jobs/process-campaign-items";
import { triggerCampaignProcessing } from "@/lib/jobs/trigger";
import { recordSignal, fingerprintContent, SIGNAL_STRENGTH } from "@/lib/creative-dna/signals";
import { recomputeCreativeDnaPreferences } from "@/lib/creative-dna/aggregate";

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

  // <input type="date"> submits "YYYY-MM-DD", which Date parses as UTC
  // midnight — advancing with setUTCDate (not the local-time setDate)
  // keeps this consistent with the calendar grid's date math
  // (src/lib/campaign-calendar.ts) regardless of server timezone.
  const start = new Date(startDate);
  const scheduledDates: Date[] = [];
  for (let i = 0; i < days; i += 1) {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + i);
    scheduledDates.push(date);
  }

  // Only platforms this company can actually publish to — never a
  // platform this app has no integration for at all (e.g. TikTok).
  const connectedAccounts = await db.socialAccount.findMany({
    where: { companyId: company.id },
    select: { platform: true },
    distinct: ["platform"],
  });
  const connectedPlatforms = connectedAccounts.map((a) => a.platform);

  let brief;
  try {
    brief = await textProvider.generateCampaignBrief({
      context,
      objective,
      itemCount: days,
      scheduledDates: scheduledDates.map((d) => d.toISOString().slice(0, 10)),
      connectedPlatforms,
    });
  } catch (error) {
    if (error instanceof ProviderError) {
      return { error: `${error.providerName}: ${error.message}` };
    }
    throw error;
  }

  const campaign = await db.campaign.create({
    data: {
      companyId: company.id,
      name: objective.length > 60 ? `${objective.slice(0, 57)}...` : objective,
      objective,
      campaignType: brief.campaignType,
      items: {
        create: brief.items.map((item, index) => ({
          scheduledDate: scheduledDates[index],
          angle: item.angle,
          assetType: item.assetType,
          headline: item.headline,
          subhead: item.subhead,
          cta: item.cta,
          captionText: item.captionText,
          hashtags: item.hashtags,
          targetPlatforms: item.targetPlatforms,
          suggestedPostAt: new Date(item.suggestedPostAt),
        })),
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

    // Part 4.2's positive half: only meaningful when the user actually
    // regenerated at least once before settling on this final version —
    // generationAttempt === 0 means there was nothing to choose BETWEEN,
    // so no REGEN_CHOSEN signal without a real contrast to justify it.
    if (item.generationAttempt > 0) {
      const [campaign, poster, video] = await Promise.all([
        db.campaign.findUnique({ where: { id: item.campaignId }, select: { campaignType: true } }),
        item.posterId ? db.poster.findUnique({ where: { id: item.posterId } }) : null,
        item.videoId ? db.video.findUnique({ where: { id: item.videoId } }) : null,
      ]);
      await recordSignal({
        companyId: company.id,
        sourceType: "REGEN_CHOSEN",
        strength: SIGNAL_STRENGTH.REGEN_CHOSEN,
        topic: campaign?.campaignType,
        template: poster?.template ?? video?.template,
        visualStyle: poster?.backgroundSource,
        posterId: item.posterId,
        videoId: item.videoId,
        campaignItemId: item.id,
      });
      await recomputeCreativeDnaPreferences(company.id);
    }
  }

  revalidatePath(`/campaigns/${item.campaignId}`);
}

// Covers both "retry a permanently-failed item" and "regenerate with a
// newly edited angle" — both just mean "generate this item again from
// scratch." Bound as `.bind(null, itemId)` on a <form>, so the trailing
// argument is always the form's FormData (React's calling convention
// for bound form actions) — an empty/missing "angle" field means a
// plain retry with the existing text.
//
// Awaits the actual generation itself (processSingleCampaignItem)
// rather than the fire-and-forget triggerCampaignProcessing() the rest
// of this file uses — a real production incident showed that on Vercel
// serverless, a fire-and-forget call can be frozen mid-render with no
// error ever recorded, leaving the item stuck in GENERATING forever.
// Awaiting means the Server Action's own response (and this route's
// maxDuration budget — see campaigns/[id]/page.tsx) doesn't return
// until the item has genuinely finished, one way or another, so
// "Regenerate" always reflects a real outcome, not a silent no-op.
export async function regenerateCampaignItem(itemId: string, formData: FormData): Promise<void> {
  const { company } = await requireCompany();
  const item = await requireOwnedCampaignItem(itemId, company.id);

  // Part 4.2's soft-negative half — recorded against the OUTGOING
  // content before this function's own update/regenerate overwrites
  // it. Weaker than a DELETE (SIGNAL_STRENGTH.REGEN_REJECTED, not
  // .DELETE): regenerating doesn't necessarily mean this content was
  // bad, only that the user wanted to see another option.
  if (item.status !== "READY" && item.status !== "APPROVED") {
    // A regenerate on a PENDING/FAILED item is a retry, not "I saw this
    // and wanted something else" — nothing was actually rejected.
  } else {
    const [campaign, poster, video] = await Promise.all([
      db.campaign.findUnique({ where: { id: item.campaignId }, select: { campaignType: true } }),
      item.posterId ? db.poster.findUnique({ where: { id: item.posterId } }) : null,
      item.videoId ? db.video.findUnique({ where: { id: item.videoId } }) : null,
    ]);
    await recordSignal({
      companyId: company.id,
      sourceType: "REGEN_REJECTED",
      strength: SIGNAL_STRENGTH.REGEN_REJECTED,
      topic: campaign?.campaignType,
      template: poster?.template ?? video?.template,
      visualStyle: poster?.backgroundSource,
      posterId: item.posterId,
      videoId: item.videoId,
      campaignItemId: item.id,
    });
  }

  const newAngle = formData.get("angle");
  const trimmed = typeof newAngle === "string" ? newAngle.trim() : "";

  const updated = await db.campaignItem.update({
    where: { id: item.id },
    data: {
      angle: trimmed ? trimmed : item.angle,
      status: "PENDING",
      retryCount: 0,
      nextAttemptAt: new Date(),
      errorMessage: null,
      // See POSTER_TEMPLATE_ROTATION/selectAutoAssetIds in
      // process-campaign-items.ts — guarantees this regenerate produces
      // a genuinely different template/footage choice, not a
      // pixel-identical re-render of the same deterministic inputs.
      generationAttempt: { increment: 1 },
    },
    include: { campaign: true },
  });

  await processSingleCampaignItem(updated);
  await recomputeCreativeDnaPreferences(company.id);
  revalidatePath(`/campaigns/${item.campaignId}`);
}

export async function removeCampaignItem(itemId: string): Promise<void> {
  const { company } = await requireCompany();
  const item = await requireOwnedCampaignItem(itemId, company.id);

  // Real negative signal (Part 1.2) — recorded BEFORE the delete, since
  // the poster/video row (and the campaignType this item belongs to)
  // must still exist to read its real attributes. Deleting the
  // CampaignItem itself doesn't cascade-delete the Poster/Video
  // (onDelete: SetNull), so this is a real, separate read, not a race.
  const [campaign, poster, video] = await Promise.all([
    db.campaign.findUnique({ where: { id: item.campaignId }, select: { campaignType: true } }),
    item.posterId ? db.poster.findUnique({ where: { id: item.posterId } }) : null,
    item.videoId ? db.video.findUnique({ where: { id: item.videoId } }) : null,
  ]);

  const generatedText = [item.headline, item.subhead, item.cta, item.captionText, item.angle]
    .filter(Boolean)
    .join(" ");

  await recordSignal({
    companyId: company.id,
    sourceType: "DELETE",
    strength: SIGNAL_STRENGTH.DELETE,
    topic: campaign?.campaignType,
    // Poster.template (PosterTemplate) and Video.template (VideoTemplate)
    // are different enums but both real, stored, per-item template
    // choices — either one, whichever this item actually is.
    template: poster?.template ?? video?.template,
    // backgroundSource (branded gradient vs an uploaded photo vs an AI
    // background) is the closest thing this app has to a per-item
    // "visual style" attribute — Poster-only, Video has no equivalent
    // field, so this stays unset for video items. Posters/videos have
    // no separate tone field either, so tone stays unset for this
    // signal type regardless of asset type.
    visualStyle: poster?.backgroundSource,
    posterId: item.posterId,
    videoId: item.videoId,
    campaignItemId: item.id,
    contentFingerprint: generatedText ? fingerprintContent(generatedText) : undefined,
  });

  await db.campaignItem.delete({ where: { id: item.id } });
  await recomputeCreativeDnaPreferences(company.id);
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

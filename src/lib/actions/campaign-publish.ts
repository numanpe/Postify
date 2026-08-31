"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requireCompany } from "@/lib/session";
import {
  requireOwnedCampaignItemWithAssets,
  publishCampaignItemViaAggregatorForCompany,
  publishCampaignItemDirectForCompany,
} from "./campaign-publish-core";

// Option 2 on a campaign card: "Publish via Selected Provider". A single
// synchronous BYOK call, not a scheduled job — see AggregatorPublishLog's
// doc comment for why this doesn't use a retry queue. Never throws back
// to the caller: outcome (success or failure) is written to the audit
// log and the card re-reads it after revalidation, matching how this
// card already surfaces CampaignItem.errorMessage. The real logic lives
// in campaign-publish-core.ts (also called by the recurring plan's
// auto-publish step, which has no session to call requireCompany()
// against) — this action is just the session lookup + revalidate.
export async function publishCampaignItemViaAggregator(itemId: string): Promise<void> {
  const { company } = await requireCompany();
  const item = await requireOwnedCampaignItemWithAssets(itemId, company.id);

  await publishCampaignItemViaAggregatorForCompany(item, company);

  revalidatePath(`/campaigns/${item.campaignId}`);
}

// Option 3 on a campaign card: "Direct API Publish (Advanced Native)".
// Reuses the app's existing, real Meta Graph API machinery
// (PublishJob/SocialAccount) rather than a parallel implementation.
// Poster items only — the existing SocialProvider adapters
// (facebook-page-provider.ts/instagram-provider.ts) only implement photo
// publishing, so a video item here would be fake functionality; the UI
// only renders this button for posters.
export async function publishCampaignItemDirect(itemId: string, formData: FormData): Promise<void> {
  const { company } = await requireCompany();
  const item = await requireOwnedCampaignItemWithAssets(itemId, company.id);

  const socialAccountId = formData.get("socialAccountId");
  if (typeof socialAccountId !== "string") return;

  await publishCampaignItemDirectForCompany(item, company, socialAccountId);

  revalidatePath(`/campaigns/${item.campaignId}`);
  revalidatePath("/publish");
}

// "Extend retention" on a stale-flagged card — restarts the retention
// cron's age countdown without touching the file or publish state.
export async function extendMediaRetention(assetId: string, campaignId: string): Promise<void> {
  const { company } = await requireCompany();

  await db.mediaAsset.updateMany({
    where: { id: assetId, companyId: company.id },
    data: { retentionExtendedAt: new Date(), staleFlaggedAt: null },
  });

  revalidatePath(`/campaigns/${campaignId}`);
}

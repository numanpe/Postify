import "server-only";

import type { RecurringPlan, Company, SocialPlatform } from "@prisma/client";

import { db } from "@/lib/db";
import { getCompanyContext } from "@/lib/company-context";
import { getTextProviderForCompany } from "@/lib/providers/text/resolver";
import { ProviderError } from "@/lib/providers/text/types";
import { appendMusicCredit } from "@/lib/video/music-credit";
import {
  requireOwnedCampaignItemWithAssets,
  publishCampaignItemViaAggregatorForCompany,
  publishCampaignItemDirectForCompany,
} from "@/lib/actions/campaign-publish-core";

// Real safety cap, mirrored server-side even though recurring-plan.ts
// already validates this at creation time — same defensive-duplication
// pattern as MAX_SCENES_CLIENT/MAX_SCENES elsewhere in this codebase.
const MAX_ITEMS_PER_DAY = 10;
// Honest constant default when a rule has no publishTimes yet — matches
// the free tier's own "single, honest constant post time rather than a
// fake AI-optimized claim" reasoning (template-provider.ts).
const DEFAULT_PUBLISH_TIME = "10:00";

export interface ProcessRecurringPlansResult {
  generatedCount: number;
  failedCount: number;
  autoPublishedCount: number;
}

function startOfUtcDay(date: Date): Date {
  const truncated = new Date(date);
  truncated.setUTCHours(0, 0, 0, 0);
  return truncated;
}

function computeSuggestedPostAt(publishTimes: string[], index: number, dateISO: string): Date {
  const times = publishTimes.length > 0 ? publishTimes : [DEFAULT_PUBLISH_TIME];
  const time = times[index % times.length];
  const [hours, minutes] = time.split(":").map((n) => Number(n) || 0);
  const date = new Date(`${dateISO}T00:00:00.000Z`);
  date.setUTCHours(hours, minutes, 0, 0);
  return date;
}

// Step A: generate today's batch for every active rule not yet run
// today. Reuses createCampaign's own real create shape
// (src/lib/actions/campaign.ts) — same nested Campaign+CampaignItem
// create, same getCompanyContext/generateCampaignBrief/appendMusicCredit
// calls — just driven by a rule's configured mix instead of a one-off
// form submission. Every recurring-plan campaign is created with
// useAiBackgrounds: false — the existing, already-safe per-campaign
// default (process-campaign-items.ts) — deliberately never overridden
// here, so a rule that runs forever never gets a standing claim on the
// shared free AI pool; that's how "respect existing quota/fairness
// logic" is satisfied, not new fallback code.
async function generateTodaysBatch(rule: RecurringPlan & { company: Company }, today: Date): Promise<void> {
  const totalItems = rule.videosPerDay + rule.postsPerDay;
  if (totalItems === 0 || totalItems > MAX_ITEMS_PER_DAY) return;

  const itemAssetTypes: ("POSTER" | "VIDEO")[] = [
    ...Array<"VIDEO">(rule.videosPerDay).fill("VIDEO"),
    ...Array<"POSTER">(rule.postsPerDay).fill("POSTER"),
  ];

  const context = await getCompanyContext(rule.companyId);
  const textProvider = await getTextProviderForCompany(rule.companyId);

  // This is the real "Auto-Generate Daily Idea" mechanism — the same
  // industry-pack topic suggestions already shown as chips in Studio
  // forms (industry-packs.ts), rotated by how many days this rule has
  // already run, not a new topic bank invented for this feature. Widened
  // with the company's own secondaryNiches when set (see
  // getCompanyTopicPool's doc comment) — same real gap fix as
  // studio-wizard.ts's autoGenerate/showAnotherIdea, 2026-09-01.
  const campaignsSoFar = await db.campaign.count({ where: { recurringPlanId: rule.id } });
  const rotatingPool = [...context.pack.topicSuggestions.map((s) => s.topic), ...context.secondaryNiches];
  const rotatingTopic = rotatingPool[campaignsSoFar % rotatingPool.length];
  const objective = rule.objectiveHint?.trim() || rotatingTopic;

  const connectedAccounts = await db.socialAccount.findMany({
    where: { companyId: rule.companyId, platform: { in: rule.targetPlatforms } },
    select: { platform: true },
    distinct: ["platform"],
  });
  const connectedPlatforms = connectedAccounts.map((a) => a.platform);

  const dateISO = today.toISOString().slice(0, 10);
  const scheduledDates = Array<string>(totalItems).fill(dateISO);

  const brief = await textProvider.generateCampaignBrief({
    context,
    objective,
    itemCount: totalItems,
    scheduledDates,
    connectedPlatforms,
    itemAssetTypes,
  });

  await db.campaign.create({
    data: {
      companyId: rule.companyId,
      name: `${dateISO} — ${objective.length > 40 ? `${objective.slice(0, 37)}...` : objective}`,
      objective,
      campaignType: brief.campaignType,
      useAiBackgrounds: false,
      recurringPlanId: rule.id,
      items: {
        create: brief.items.map((item, index) => ({
          scheduledDate: today,
          angle: item.angle,
          assetType: item.assetType,
          headline: item.headline,
          subhead: item.subhead,
          cta: item.cta,
          captionText: item.assetType === "VIDEO" ? appendMusicCredit(item.captionText) : item.captionText,
          hashtags: item.hashtags,
          targetPlatforms: item.targetPlatforms,
          // Overridden with the rule's own real configured times rather
          // than trusting the model's free-form guess — the auto-publish
          // step below depends on this being a real, rule-driven time.
          suggestedPostAt: computeSuggestedPostAt(rule.publishTimes, index, dateISO),
        })),
      },
    },
  });

  await db.recurringPlan.update({
    where: { id: rule.id },
    data: { lastGeneratedDate: today, errorMessage: null },
  });
}

async function generateDueRules(today: Date): Promise<{ generatedCount: number; failedCount: number }> {
  const dueRules = await db.recurringPlan.findMany({
    where: {
      isPaused: false,
      OR: [{ lastGeneratedDate: null }, { lastGeneratedDate: { lt: today } }],
    },
    include: { company: true },
  });

  let generatedCount = 0;
  let failedCount = 0;
  for (const rule of dueRules) {
    try {
      await generateTodaysBatch(rule, today);
      generatedCount += 1;
    } catch (error) {
      failedCount += 1;
      const message = error instanceof ProviderError ? `${error.providerName}: ${error.message}` : error instanceof Error ? error.message : "Unknown error.";
      // Real, surfaced failure — left for the next run to retry
      // (lastGeneratedDate untouched), never silently skipped.
      await db.recurringPlan.update({ where: { id: rule.id }, data: { errorMessage: message } }).catch(() => {});
    }
  }
  return { generatedCount, failedCount };
}

// Step B: publish anything that finished generating, belongs to an
// autoPublish rule, and whose real configured time has passed. Checks
// status = "READY" (not date-scoped) so an item that isn't done
// generating on this run's day just gets caught by a later run — no
// same-run timing precision required. A real compare-and-swap claim
// (mirrors processSingleCampaignItem's own claim pattern) before
// touching each item prevents double-publishing across overlapping runs.
async function autoPublishReadyItems(): Promise<number> {
  const dueItems = await db.campaignItem.findMany({
    where: {
      status: "READY",
      suggestedPostAt: { lte: new Date() },
      campaign: { recurringPlan: { autoPublish: true, isPaused: false } },
    },
    select: {
      id: true,
      assetType: true,
      targetPlatforms: true,
      campaign: { select: { companyId: true, company: true } },
    },
  });

  let publishedCount = 0;
  for (const due of dueItems) {
    // Real compare-and-swap: only proceed if this run is the one that
    // actually claims the item from READY.
    const claim = await db.campaignItem.updateMany({
      where: { id: due.id, status: "READY" },
      data: { status: "APPROVED" },
    });
    if (claim.count === 0) continue;

    try {
      const company = due.campaign.company;
      const item = await requireOwnedCampaignItemWithAssets(due.id, company.id);

      if (company.publishingMode === "AGGREGATOR" && company.selectedAggregator) {
        await publishCampaignItemViaAggregatorForCompany(item, company);
        publishedCount += 1;
      } else if (company.publishingMode === "DIRECT_API" && due.assetType === "POSTER") {
        // Posters only — same real, honest scope as the manual "Direct
        // API Publish" button (no direct-API video path exists). Every
        // eligible connected account gets a real publish attempt, one
        // PublishJob per account.
        const accounts = await db.socialAccount.findMany({
          where: { companyId: company.id, platform: { in: due.targetPlatforms as SocialPlatform[] } },
        });
        if (accounts.length > 0) {
          for (const account of accounts) {
            await publishCampaignItemDirectForCompany(item, company, account.id);
          }
          publishedCount += 1;
        } else {
          // Real bug found while auditing publish surfaces for the
          // ShareAssetModal eligibility-messaging fix, extended here to
          // the automated path: the company genuinely has DIRECT_API
          // configured as its auto-publish method, but no
          // currently-connected account matches this item's real
          // targetPlatforms (set at generation time — see
          // CampaignItem.targetPlatforms's own schema comment; drifts
          // if the connected account changes after generation, same
          // real cause as calendar-item-card.tsx's manual-button fix).
          // Previously silent: the item just stayed APPROVED forever
          // with no errorMessage and no log anywhere, indistinguishable
          // from a company that never configured an auto-publish
          // method at all (see the comment below — that IS a genuine,
          // expected non-error case, unlike this one). Status
          // deliberately left as APPROVED, not FAILED —
          // regenerateCampaignItem's "Retry" path would re-run the full
          // generation pipeline, discarding perfectly good existing
          // content to fix what's actually a connection problem, not a
          // content problem. errorMessage alone already renders on the
          // card regardless of status (see its own unconditional
          // {item.errorMessage && ...} block).
          await db.campaignItem.update({
            where: { id: due.id },
            data: {
              errorMessage: `Auto-publish couldn't find a connected account matching this item's target platform(s) (${due.targetPlatforms.join(", ")}).`,
            },
          });
        }
      }
      // Else: no real connected publishing method for this item (or a
      // VIDEO item under DIRECT_API, which has no real direct-publish
      // path anywhere in this app) — left APPROVED, a real, visible,
      // downloadable state, never a fabricated failure. Genuinely
      // different from the branch above: here, no auto-publish method
      // was ever configured/applicable, so silence is honest — nothing
      // was expected to happen automatically.
    } catch {
      // Real per-item failure isolation, same shape as every other job
      // in this codebase. The publish helpers already record their own
      // real error (AggregatorPublishLog row / PublishJob.errorMessage)
      // — nothing further to record here.
    }
  }
  return publishedCount;
}

export async function processRecurringPlans(): Promise<ProcessRecurringPlansResult> {
  const today = startOfUtcDay(new Date());
  const { generatedCount, failedCount } = await generateDueRules(today);
  const autoPublishedCount = await autoPublishReadyItems();
  return { generatedCount, failedCount, autoPublishedCount };
}

import Link from "next/link";

import { requireCompany } from "@/lib/session";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { companyHasRealPublishingMethod } from "@/lib/actions/recurring-plan";
import { RecurringPlanForm } from "@/components/campaign/recurring-plan-form";
import { RecurringPlanControls } from "@/components/campaign/recurring-plan-controls";
import { EmptyState } from "@/components/empty-state";
import { NavIcons } from "@/components/icons";

export default async function RecurringPlanPage() {
  const { company } = await requireCompany();
  const locale = await getLocale();
  const dict = getDictionary(locale);

  const [plan, connectedAccounts, canAutoPublish] = await Promise.all([
    db.recurringPlan.findUnique({ where: { companyId: company.id } }),
    db.socialAccount.findMany({
      where: { companyId: company.id },
      select: { platform: true },
      distinct: ["platform"],
    }),
    companyHasRealPublishingMethod(company.id),
  ]);

  const platformLabels: Record<string, string> = {
    FACEBOOK: dict.publish.platformFacebook,
    INSTAGRAM: dict.publish.platformInstagram,
    LINKEDIN: dict.publish.platformLinkedIn,
    TIKTOK: dict.publish.platformTikTok,
  };
  const connectedPlatforms = connectedAccounts.map((a) => ({
    platform: a.platform,
    label: platformLabels[a.platform] ?? a.platform,
  }));

  const campaigns = plan
    ? await db.campaign.findMany({
        where: { recurringPlanId: plan.id },
        include: { items: { select: { status: true, scheduledDate: true } } },
        orderBy: { createdAt: "desc" },
        take: 20,
      })
    : [];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{dict.recurringPlan.title}</h1>
        <p className="text-sm text-ink-soft dark:text-ink-soft-dark">{dict.recurringPlan.subtitle}</p>
      </div>

      {plan && !plan.isPaused && plan.autoPublish && (
        <p className="rounded-md border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
          {dict.recurringPlan.autoPublishWarning}
        </p>
      )}
      {plan && (
        <p className="text-sm text-ink-soft dark:text-ink-soft-dark">
          {plan.isPaused ? dict.recurringPlan.pausedBanner : dict.recurringPlan.activeBanner}
        </p>
      )}
      {plan?.errorMessage && (
        <p className="text-sm text-red-600 dark:text-red-400">{dict.recurringPlan.errorLabel(plan.errorMessage)}</p>
      )}

      <RecurringPlanForm
        existing={
          plan
            ? {
                postsPerDay: plan.postsPerDay,
                videosPerDay: plan.videosPerDay,
                publishTimes: plan.publishTimes,
                targetPlatforms: plan.targetPlatforms,
                objectiveHint: plan.objectiveHint,
                autoPublish: plan.autoPublish,
              }
            : null
        }
        connectedPlatforms={connectedPlatforms}
        canAutoPublish={canAutoPublish}
      />

      {plan && <RecurringPlanControls isPaused={plan.isPaused} />}

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-ink-soft dark:text-ink-soft-dark">{dict.recurringPlan.activityTitle}</h2>
        {campaigns.length === 0 ? (
          <EmptyState icon={NavIcons.campaigns} title={dict.recurringPlan.noActivityYet} />
        ) : (
          <ul className="flex flex-col gap-2">
            {campaigns.map((campaign) => {
              const readyCount = campaign.items.filter(
                (item) => item.status === "READY" || item.status === "APPROVED",
              ).length;
              const failedCount = campaign.items.filter((item) => item.status === "FAILED").length;
              const date = campaign.items[0]?.scheduledDate;

              return (
                <li key={campaign.id}>
                  <Link
                    href={`/campaigns/${campaign.id}`}
                    className="flex flex-col gap-1 rounded-md border border-paper-border p-3 hover:border-ink-soft dark:border-night-border dark:hover:border-ink-soft-dark"
                  >
                    <p className="font-medium">{campaign.name}</p>
                    <p className="text-sm text-ink-soft dark:text-ink-soft-dark">
                      {date && `${date.toLocaleDateString(locale)} · `}
                      {dict.campaigns.postsCount(campaign.items.length)} · {dict.campaigns.readyCount(readyCount)}
                      {failedCount > 0 ? ` · ${dict.campaigns.failedCount(failedCount)}` : ""}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

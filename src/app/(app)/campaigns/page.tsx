import Link from "next/link";

import { requireCompany } from "@/lib/session";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { CampaignForm } from "@/components/campaign/campaign-form";
import { EmptyState } from "@/components/empty-state";
import { NavIcons } from "@/components/icons";
import { resolveIndustryPack } from "@/lib/industry-packs";
import { PaginationNav } from "@/components/ui/pagination-nav";

const CAMPAIGNS_PER_PAGE = 15;

export default async function CampaignsPage({
  searchParams,
}: {
  // Prefilled when arriving from the Studio wizard's "this sounds like
  // N days of content" suggestion (see wizard-step1-form.tsx) — the
  // user still has to review and submit this real form themselves,
  // this only saves them retyping what they already said.
  searchParams: Promise<{ objective?: string; days?: string; page?: string }>;
}) {
  const { company } = await requireCompany();
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const { objective, days, page: pageParam } = await searchParams;
  const parsedDays = days ? Number(days) : undefined;
  const page = Math.max(1, Number(pageParam) || 1);

  // A recurring plan (see /campaigns/recurring) creates one of these
  // every day it runs, indefinitely — a real, growing dataset this page
  // needs to actually paginate rather than fetch in full forever.
  const [campaigns, totalCampaignCount] = await Promise.all([
    db.campaign.findMany({
      where: { companyId: company.id },
      include: { items: { select: { status: true, scheduledDate: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * CAMPAIGNS_PER_PAGE,
      take: CAMPAIGNS_PER_PAGE,
    }),
    db.campaign.count({ where: { companyId: company.id } }),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalCampaignCount / CAMPAIGNS_PER_PAGE));

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{dict.campaigns.title}</h1>
        <p className="text-sm text-ink-soft dark:text-ink-soft-dark">{dict.campaigns.subtitle(company.name)}</p>
        <Link href="/campaigns/recurring" className="w-fit text-sm font-medium text-primary underline dark:text-primary-dark">
          {dict.recurringPlan.entryLinkLabel}
        </Link>
      </div>

      <CampaignForm
        defaultObjective={objective}
        defaultDays={parsedDays && parsedDays >= 1 && parsedDays <= 14 ? parsedDays : undefined}
        topicSuggestions={resolveIndustryPack(company.primaryIndustry, company.locale).topicSuggestions}
      />

      {/* totalCampaignCount, not campaigns.length — a real campaign
          history that simply doesn't reach a manually-typed ?page=N
          shouldn't show the "create your first campaign" empty state. */}
      {totalCampaignCount === 0 && (
        <EmptyState icon={NavIcons.campaigns} title={dict.campaigns.yourCampaigns} hint={dict.campaigns.noCampaignsHint} />
      )}

      {totalCampaignCount > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-ink-soft dark:text-ink-soft-dark">{dict.campaigns.yourCampaigns}</h2>
          <ul className="flex flex-col gap-2">
            {campaigns.map((campaign) => {
              const readyCount = campaign.items.filter(
                (item) => item.status === "READY" || item.status === "APPROVED",
              ).length;
              const failedCount = campaign.items.filter((item) => item.status === "FAILED").length;
              const dates = campaign.items.map((item) => item.scheduledDate).sort((a, b) => a.getTime() - b.getTime());

              return (
                <li key={campaign.id}>
                  <Link
                    href={`/campaigns/${campaign.id}`}
                    className="flex flex-col gap-1 rounded-md border border-paper-border p-3 hover:border-ink-soft dark:border-night-border dark:hover:border-ink-soft-dark"
                  >
                    <p className="font-medium">{campaign.name}</p>
                    <p className="text-sm text-ink-soft dark:text-ink-soft-dark">
                      {dates.length > 0 && (
                        <>
                          {dates[0].toLocaleDateString(locale)} – {dates[dates.length - 1].toLocaleDateString(locale)} ·{" "}
                        </>
                      )}
                      {dict.campaigns.postsCount(campaign.items.length)} · {dict.campaigns.readyCount(readyCount)}
                      {failedCount > 0 ? ` · ${dict.campaigns.failedCount(failedCount)}` : ""}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>

          <PaginationNav
            currentPage={page}
            totalPages={totalPages}
            basePath="/campaigns"
            previousLabel={dict.common.previousPage}
            nextLabel={dict.common.nextPage}
            indicatorLabel={dict.common.pageIndicator(page, totalPages)}
          />
        </div>
      )}
    </div>
  );
}

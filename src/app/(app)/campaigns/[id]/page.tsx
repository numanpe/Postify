import { notFound } from "next/navigation";

import { requireCompany } from "@/lib/session";
import { db } from "@/lib/db";
import { buildCalendarWeeks, dateKey, formatDayNumber } from "@/lib/campaign-calendar";
import { processCampaignNow } from "@/lib/actions/campaign";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { CalendarItemCard } from "@/components/campaign/calendar-item-card";
import { Button } from "@/components/ui/button";
import { AGGREGATOR_PROVIDERS } from "@/lib/providers/aggregator/types";

// Requests the platform's maximum available execution time for this
// page's Server Actions (processCampaignNow, regenerateCampaignItem,
// which now awaits real generation instead of firing-and-forgetting —
// see campaign.ts). See process-campaign-items.ts's stuck-video
// investigation note for why this matters.
export const maxDuration = 300;

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { company } = await requireCompany();
  const dict = getDictionary(await getLocale());

  const [campaign, connectedAccounts, aggregatorCredential] = await Promise.all([
    db.campaign.findFirst({
      where: { id, companyId: company.id },
      include: {
        items: {
          include: {
            poster: { include: { asset: true } },
            video: { include: { asset: true } },
            aggregatorPublishLogs: { orderBy: { createdAt: "desc" }, take: 1 },
          },
          orderBy: { scheduledDate: "asc" },
        },
      },
    }),
    db.socialAccount.findMany({
      where: { companyId: company.id },
      select: { id: true, platform: true, displayName: true },
    }),
    company.selectedAggregator
      ? db.aggregatorCredential.findUnique({
          where: { companyId_provider: { companyId: company.id, provider: company.selectedAggregator } },
        })
      : null,
  ]);
  if (!campaign) {
    notFound();
  }

  const retentionDays = Number.parseInt(process.env.MEDIA_RETENTION_DAYS ?? "", 10) || 30;
  const aggregatorProviderName = aggregatorCredential
    ? AGGREGATOR_PROVIDERS.find((p) => p.provider === aggregatorCredential.provider)?.displayName ?? null
    : null;

  const weeks = buildCalendarWeeks(campaign.items.map((item) => item.scheduledDate));
  const itemsByDate = new Map<string, typeof campaign.items>();
  for (const item of campaign.items) {
    const key = dateKey(item.scheduledDate);
    itemsByDate.set(key, [...(itemsByDate.get(key) ?? []), item]);
  }

  const pendingCount = campaign.items.filter(
    (item) => item.status === "PENDING" || item.status === "GENERATING",
  ).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold">{campaign.name}</h1>
          <span className="rounded-full border border-paper-border dark:border-night-border px-2 py-0.5 text-xs font-medium text-ink-soft dark:text-ink-soft-dark">
            {campaign.campaignType}
          </span>
        </div>
        <p className="text-sm text-ink-soft dark:text-ink-soft-dark">{campaign.objective}</p>
      </div>

      {pendingCount > 0 && (
        <form action={processCampaignNow.bind(null, campaign.id)} className="flex items-center gap-3">
          <Button type="submit" size="sm">
            {dict.common.processNow}
          </Button>
          <p className="text-sm text-ink-soft dark:text-ink-soft-dark">{dict.campaigns.processingHint(pendingCount)}</p>
        </form>
      )}

      <div className="overflow-x-auto">
        <div className="grid min-w-[760px] grid-cols-7 gap-2">
          {dict.campaigns.weekdays.map((label) => (
            <div key={label} className="text-xs font-medium text-ink-soft dark:text-ink-soft-dark">
              {label}
            </div>
          ))}
          {weeks.flat().map((date) => {
            const key = dateKey(date);
            const dayItems = itemsByDate.get(key) ?? [];
            return (
              <div
                key={key}
                className="flex min-h-[140px] flex-col gap-1 rounded-md border border-paper-border dark:border-night-border p-1.5"
              >
                <p className="text-xs text-ink-soft dark:text-ink-soft-dark">{formatDayNumber(date)}</p>
                {dayItems.map((item) => (
                  <CalendarItemCard
                    key={item.id}
                    item={item}
                    connectedAccounts={connectedAccounts}
                    aggregatorConfigured={!!aggregatorCredential}
                    aggregatorProviderName={aggregatorProviderName}
                    retentionDays={retentionDays}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

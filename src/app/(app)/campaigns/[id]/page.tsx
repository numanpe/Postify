import { notFound } from "next/navigation";

import { requireCompany } from "@/lib/session";
import { db } from "@/lib/db";
import { buildCalendarWeeks, dateKey, formatDayNumber } from "@/lib/campaign-calendar";
import { processCampaignNow } from "@/lib/actions/campaign";
import { CalendarItemCard } from "@/components/campaign/calendar-item-card";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { company } = await requireCompany();

  const campaign = await db.campaign.findFirst({
    where: { id, companyId: company.id },
    include: {
      items: {
        include: { poster: { include: { asset: true } } },
        orderBy: { scheduledDate: "asc" },
      },
    },
  });
  if (!campaign) {
    notFound();
  }

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
        <h1 className="text-xl font-semibold">{campaign.name}</h1>
        <p className="text-sm text-neutral-500">{campaign.objective}</p>
      </div>

      {pendingCount > 0 && (
        <form action={processCampaignNow.bind(null, campaign.id)} className="flex items-center gap-3">
          <button
            type="submit"
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
          >
            Process now
          </button>
          <p className="text-sm text-neutral-500">
            {pendingCount} post{pendingCount === 1 ? "" : "s"} still generating — this app doesn&apos;t
            have a real scheduler wired up in this environment, so click to process the queue
            yourself (production would run this automatically; see README).
          </p>
        </form>
      )}

      <div className="overflow-x-auto">
        <div className="grid min-w-[760px] grid-cols-7 gap-2">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="text-xs font-medium text-neutral-500">
              {label}
            </div>
          ))}
          {weeks.flat().map((date) => {
            const key = dateKey(date);
            const dayItems = itemsByDate.get(key) ?? [];
            return (
              <div
                key={key}
                className="flex min-h-[140px] flex-col gap-1 rounded-md border border-neutral-200 p-1.5"
              >
                <p className="text-xs text-neutral-400">{formatDayNumber(date)}</p>
                {dayItems.map((item) => (
                  <CalendarItemCard key={item.id} item={item} />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

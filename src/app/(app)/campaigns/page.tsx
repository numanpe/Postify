import Link from "next/link";

import { requireCompany } from "@/lib/session";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { CampaignForm } from "@/components/campaign/campaign-form";

export default async function CampaignsPage() {
  const { company } = await requireCompany();
  const locale = await getLocale();
  const dict = getDictionary(locale);

  const campaigns = await db.campaign.findMany({
    where: { companyId: company.id },
    include: { items: { select: { status: true, scheduledDate: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{dict.campaigns.title}</h1>
        <p className="text-sm text-ink-soft dark:text-ink-soft-dark">{dict.campaigns.subtitle(company.name)}</p>
      </div>

      <CampaignForm />

      {campaigns.length > 0 && (
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
        </div>
      )}
    </div>
  );
}

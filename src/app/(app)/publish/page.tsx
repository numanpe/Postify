import Link from "next/link";

import { requireCompany } from "@/lib/session";
import { db } from "@/lib/db";
import { processPublishJobsNow } from "@/lib/actions/publish";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { ConnectAccounts } from "@/components/publish/connect-accounts";
import { CreatePublishJobForm } from "@/components/publish/create-publish-job-form";
import { PublishJobList } from "@/components/publish/publish-job-list";
import { Button } from "@/components/ui/button";

export default async function PublishPage({
  searchParams,
}: {
  searchParams: Promise<{ meta?: string; detail?: string; linkedin?: string; tiktok?: string }>;
}) {
  const { company } = await requireCompany();
  const { meta, detail, linkedin, tiktok } = await searchParams;
  const dict = getDictionary(await getLocale());

  const [accounts, posters, videos, jobs] = await Promise.all([
    db.socialAccount.findMany({ where: { companyId: company.id }, orderBy: { connectedAt: "asc" } }),
    db.poster.findMany({
      where: { companyId: company.id },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: { id: true, headline: true, subhead: true, cta: true },
    }),
    db.video.findMany({
      where: { companyId: company.id },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: { id: true, topic: true },
    }),
    db.publishJob.findMany({
      where: { companyId: company.id },
      include: {
        socialAccount: true,
        poster: { select: { headline: true } },
        video: { select: { topic: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const connectStatus = meta ?? linkedin ?? tiktok;

  const pendingCount = jobs.filter(
    (job) => job.status === "SCHEDULED" || job.status === "PUBLISHING",
  ).length;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{dict.publish.title}</h1>
        <p className="text-sm text-ink-soft dark:text-ink-soft-dark">{dict.publish.subtitle}</p>
      </div>

      {connectStatus === "connected" && (
        <p className="rounded-md border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950 px-3 py-2 text-sm text-green-800 dark:text-green-300">
          {dict.publish.connectedSuccess}
        </p>
      )}
      {connectStatus === "error" && (
        <p className="rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-800 dark:text-red-300">
          {dict.publish.connectedError(detail ?? "Unknown error.")}
        </p>
      )}

      <ConnectAccounts accounts={accounts} />

      {posters.length === 0 && videos.length === 0 ? (
        <p className="text-sm text-ink-soft dark:text-ink-soft-dark">
          {dict.publish.noPostersYetPrefix}{" "}
          <Link href="/studio/poster" className="underline">
            {dict.nav.poster}
          </Link>{" "}
          {dict.publish.noPostersYetSuffix}
        </p>
      ) : accounts.length === 0 ? (
        <p className="text-sm text-ink-soft dark:text-ink-soft-dark">{dict.publish.connectFirst}</p>
      ) : (
        <CreatePublishJobForm accounts={accounts} posters={posters} videos={videos} />
      )}

      {pendingCount > 0 && (
        <form action={processPublishJobsNow} className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="sm">
            {dict.common.processNow}
          </Button>
          <p className="text-sm text-ink-soft dark:text-ink-soft-dark">{dict.publish.processingHint(pendingCount)}</p>
        </form>
      )}

      <PublishJobList jobs={jobs} />
    </div>
  );
}

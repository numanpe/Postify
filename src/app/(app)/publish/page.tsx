import Link from "next/link";

import { requireCompany } from "@/lib/session";
import { db } from "@/lib/db";
import { processPublishJobsNow } from "@/lib/actions/publish";
import { ConnectAccounts } from "@/components/publish/connect-accounts";
import { CreatePublishJobForm } from "@/components/publish/create-publish-job-form";
import { PublishJobList } from "@/components/publish/publish-job-list";
import { Button } from "@/components/ui/button";

export default async function PublishPage({
  searchParams,
}: {
  searchParams: Promise<{ meta?: string; detail?: string }>;
}) {
  const { company } = await requireCompany();
  const { meta, detail } = await searchParams;

  const [accounts, posters, jobs] = await Promise.all([
    db.socialAccount.findMany({ where: { companyId: company.id }, orderBy: { connectedAt: "asc" } }),
    db.poster.findMany({
      where: { companyId: company.id },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: { id: true, headline: true, subhead: true, cta: true },
    }),
    db.publishJob.findMany({
      where: { companyId: company.id },
      include: { socialAccount: true, poster: { select: { headline: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const pendingCount = jobs.filter(
    (job) => job.status === "SCHEDULED" || job.status === "PUBLISHING",
  ).length;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Publish</h1>
        <p className="text-sm text-ink-soft dark:text-ink-soft-dark">
          Post an existing poster directly to a connected Facebook Page or Instagram account.
        </p>
      </div>

      {meta === "connected" && (
        <p className="rounded-md border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950 px-3 py-2 text-sm text-green-800 dark:text-green-300">
          Connected successfully.
        </p>
      )}
      {meta === "error" && (
        <p className="rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-800 dark:text-red-300">
          Couldn&apos;t connect: {detail ?? "Unknown error."}
        </p>
      )}

      <ConnectAccounts accounts={accounts} />

      {posters.length === 0 ? (
        <p className="text-sm text-ink-soft dark:text-ink-soft-dark">
          No posters yet — generate one in the{" "}
          <Link href="/poster" className="underline">
            Poster Studio
          </Link>{" "}
          first.
        </p>
      ) : accounts.length === 0 ? (
        <p className="text-sm text-ink-soft dark:text-ink-soft-dark">
          Connect a Facebook Page or Instagram account above before you can publish.
        </p>
      ) : (
        <CreatePublishJobForm accounts={accounts} posters={posters} />
      )}

      {pendingCount > 0 && (
        <form action={processPublishJobsNow} className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="sm">
            Process now
          </Button>
          <p className="text-sm text-ink-soft dark:text-ink-soft-dark">
            {pendingCount} job{pendingCount === 1 ? "" : "s"} queued — this app doesn&apos;t have a
            real scheduler wired up in this environment, so click to process the queue yourself
            (production would run this automatically; see README).
          </p>
        </form>
      )}

      <PublishJobList jobs={jobs} />
    </div>
  );
}

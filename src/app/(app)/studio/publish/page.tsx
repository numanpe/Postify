import { notFound } from "next/navigation";
import Link from "next/link";

import { requireCompany } from "@/lib/session";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { suggestPeakPublishTime } from "@/lib/scheduling/smart-scheduler";
import { SocialMediaPreviewer } from "@/components/social-preview/social-media-previewer";
import { CreatePublishJobForm } from "@/components/publish/create-publish-job-form";

// Step 3 of the guided wizard. Real preview (the same SocialMediaPreviewer
// used everywhere else), a real suggested time from Task 5's smart
// scheduler, and a real publish path for posters — reusing
// CreatePublishJobForm exactly as /publish does, not a second
// duplicate publish implementation. Videos honestly don't have a
// direct-publish path in this app yet (PublishJob only has a
// posterId field — videos currently only publish through the Campaign
// pipeline), so that case gets a real, disclosed limitation instead of
// a button that would silently do nothing.
export default async function StudioWizardStep3Page({
  searchParams,
}: {
  searchParams: Promise<{ assetType?: string; id?: string }>;
}) {
  const { company } = await requireCompany();
  const { assetType, id } = await searchParams;
  const dict = getDictionary(await getLocale());

  if (!id || (assetType !== "poster" && assetType !== "video")) {
    notFound();
  }

  const [brandKit, connectedAccounts] = await Promise.all([
    db.brandKit.findUnique({ where: { companyId: company.id }, include: { logoAsset: true } }),
    db.socialAccount.findMany({ where: { companyId: company.id }, orderBy: { connectedAt: "asc" } }),
  ]);
  const logoUrl = brandKit?.logoAsset ? storage.url(brandKit.logoAsset.storageKey) : null;

  const suggestion = await suggestPeakPublishTime(company.id);
  const suggestionLabel =
    suggestion.source === "learned" && suggestion.sampleSize
      ? dict.wizard.autoScheduledLearned(suggestion.sampleSize)
      : dict.wizard.autoScheduledDefault;

  if (assetType === "poster") {
    const poster = await db.poster.findFirst({ where: { id, companyId: company.id }, include: { asset: true } });
    if (!poster) notFound();

    return (
      <div className="flex w-full max-w-lg flex-col gap-6">
        <StepHeader title={dict.wizard.step3Title} backLabel={dict.wizard.backToEdit} />
        {poster.asset.width && poster.asset.height && (
          <SocialMediaPreviewer
            mediaUrl={storage.url(poster.asset.storageKey)}
            mediaType="image"
            mediaWidth={poster.asset.width}
            mediaHeight={poster.asset.height}
            companyName={company.name}
            logoUrl={logoUrl}
            captionText={[poster.headline, poster.subhead, poster.cta].filter(Boolean).join("\n\n")}
          />
        )}

        <div className="rounded-md border border-paper-border p-3 text-xs text-ink-soft dark:border-night-border dark:text-ink-soft-dark">
          <span className="font-medium text-ink dark:text-ink-dark">{dict.wizard.autoScheduledLabel}: </span>
          {suggestionLabel}
        </div>

        {connectedAccounts.length > 0 ? (
          <CreatePublishJobForm
            accounts={connectedAccounts}
            posters={[{ id: poster.id, headline: poster.headline, subhead: poster.subhead, cta: poster.cta }]}
          />
        ) : (
          <p className="text-sm text-ink-soft dark:text-ink-soft-dark">
            {dict.publish.connectFirst}{" "}
            <Link href="/publish" className="underline">
              {dict.publish.connectedAccounts}
            </Link>
          </p>
        )}
      </div>
    );
  }

  const video = await db.video.findFirst({ where: { id, companyId: company.id }, include: { asset: true } });
  if (!video) notFound();

  return (
    <div className="flex w-full max-w-lg flex-col gap-6">
      <StepHeader title={dict.wizard.step3Title} backLabel={dict.wizard.backToEdit} />
      {video.asset.width && video.asset.height && (
        <SocialMediaPreviewer
          mediaUrl={storage.url(video.asset.storageKey)}
          mediaType="video"
          mediaWidth={video.asset.width}
          mediaHeight={video.asset.height}
          companyName={company.name}
          logoUrl={logoUrl}
          captionText={video.topic}
        />
      )}

      <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
        {dict.wizard.videoPublishUnavailable}
      </div>
      <a
        href={storage.url(video.asset.storageKey)}
        download
        className="w-fit rounded-md border border-paper-border px-4 py-2 text-sm font-medium text-ink hover:bg-paper-card dark:border-night-border dark:text-ink-dark dark:hover:bg-night-card"
      >
        {dict.wizard.downloadVideo}
      </a>
    </div>
  );
}

function StepHeader({ title, backLabel }: { title: string; backLabel: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-xl font-semibold">{title}</h1>
      <Link href="/studio/design" className="w-fit text-xs text-ink-soft underline dark:text-ink-soft-dark">
        {backLabel}
      </Link>
    </div>
  );
}

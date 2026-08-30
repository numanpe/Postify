import Image from "next/image";
import Link from "next/link";

import { requireCompany } from "@/lib/session";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { formatBytes } from "@/lib/format";
import { deleteMedia } from "@/lib/actions/media";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { resolveSceneThumbnailUrl } from "@/lib/video/scene-thumbnails";
import { UploadMediaForm } from "@/components/media/upload-media-form";
import { EmptyState } from "@/components/empty-state";
import { NavIcons } from "@/components/icons";
import { VideoEditModal, type SceneMediaAssetOption } from "@/components/campaign/video-edit-modal";
import { RegenerateBackgroundButton } from "@/components/poster/regenerate-background-button";
import type { VideoScriptSections } from "@/lib/providers/text/types";

interface ActivityEvent {
  id: string;
  succeeded: boolean;
  label: string;
  campaignId: string | null;
  when: Date;
}

// Same truncation convention calendar-item-card.tsx already uses for
// CampaignItem.errorMessage — kept consistent rather than inventing a
// second one.
function truncate(text: string, max = 40): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export default async function MediaPage() {
  const { company } = await requireCompany();
  const locale = await getLocale();
  const dict = getDictionary(locale);

  const [assets, publishJobs, aggregatorLogs, failedItems] = await Promise.all([
    db.mediaAsset.findMany({
      where: { companyId: company.id },
      orderBy: { createdAt: "desc" },
      include: {
        videoOutput: {
          include: {
            scenes: {
              include: { mediaAsset: { select: { id: true, fileName: true, storageKey: true } } },
              orderBy: { order: "asc" },
            },
          },
        },
        posterOutput: true,
        brandKitLogo: true,
      },
    }),
    // Recent Activity's three real sources — no new tracking, all
    // already recorded by the existing generation/publish pipelines.
    db.publishJob.findMany({
      where: { companyId: company.id, status: { in: ["PUBLISHED", "FAILED"] } },
      orderBy: { updatedAt: "desc" },
      take: 5,
      include: {
        socialAccount: { select: { platform: true, displayName: true } },
        poster: { select: { headline: true, campaignItem: { select: { campaignId: true } } } },
        video: { select: { topic: true, campaignItem: { select: { campaignId: true } } } },
      },
    }),
    db.aggregatorPublishLog.findMany({
      where: { companyId: company.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { campaignItem: { select: { angle: true, campaignId: true } } },
    }),
    db.campaignItem.findMany({
      where: { campaign: { companyId: company.id }, status: "FAILED" },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, campaignId: true, updatedAt: true, campaign: { select: { name: true } } },
    }),
  ]);

  const events: ActivityEvent[] = [];

  for (const job of publishJobs) {
    const platform = job.socialAccount.displayName || job.socialAccount.platform;
    const content = job.poster?.headline ?? job.video?.topic ?? platform;
    const campaignId = job.poster?.campaignItem?.campaignId ?? job.video?.campaignItem?.campaignId ?? null;
    events.push({
      id: `job-${job.id}`,
      succeeded: job.status === "PUBLISHED",
      label:
        job.status === "PUBLISHED"
          ? dict.media.activityPublished(`${content} → ${platform}`)
          : dict.media.activityPublishFailed(job.errorMessage ? `${content}: ${truncate(job.errorMessage)}` : content),
      campaignId,
      when: job.updatedAt,
    });
  }

  for (const log of aggregatorLogs) {
    events.push({
      id: `agg-${log.id}`,
      succeeded: log.succeeded,
      label: log.succeeded
        ? dict.media.activityPublished(log.campaignItem.angle)
        : dict.media.activityPublishFailed(
            log.errorMessage ? `${log.campaignItem.angle}: ${truncate(log.errorMessage)}` : log.campaignItem.angle,
          ),
      campaignId: log.campaignItem.campaignId,
      when: log.createdAt,
    });
  }

  for (const item of failedItems) {
    events.push({
      id: `item-${item.id}`,
      succeeded: false,
      label: dict.media.activityGenerationFailed(item.campaign.name),
      campaignId: item.campaignId,
      when: item.updatedAt,
    });
  }

  const recentActivity = events.sort((a, b) => b.when.getTime() - a.when.getTime()).slice(0, 6);

  // Same "real, usable media" exclusion filter the video edit/swap
  // pickers already apply elsewhere (studio/[mode]/page.tsx,
  // campaigns/[id]/page.tsx) — derived from the assets already fetched
  // above instead of a second DB round-trip, since this page already
  // loads every company asset.
  const sceneMediaAssets: SceneMediaAssetOption[] = assets
    .filter(
      (a) =>
        !a.posterOutput &&
        !a.videoOutput &&
        !a.brandKitLogo &&
        !a.storageDeletedAt &&
        (a.mimeType.startsWith("image/") || a.mimeType.startsWith("video/")),
    )
    .map((a) => ({ id: a.id, fileName: a.fileName, mimeType: a.mimeType }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{dict.media.title}</h1>
        <p className="text-sm text-ink-soft dark:text-ink-soft-dark">{dict.media.subtitle(company.name)}</p>
      </div>

      {recentActivity.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-ink-soft dark:text-ink-soft-dark">{dict.media.activityTitle}</h2>
          <ul className="flex flex-col gap-1.5 rounded-lg border border-paper-border dark:border-night-border p-2">
            {recentActivity.map((event) => (
              <li key={event.id} className="flex items-center gap-2 text-xs">
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    event.succeeded ? "bg-green-600 dark:bg-green-400" : "bg-red-600 dark:bg-red-400"
                  }`}
                  aria-hidden="true"
                />
                {event.campaignId ? (
                  <Link href={`/campaigns/${event.campaignId}`} className="truncate underline-offset-2 hover:underline">
                    {event.label}
                  </Link>
                ) : (
                  <span className="truncate">{event.label}</span>
                )}
                <span className="ms-auto shrink-0 text-ink-soft dark:text-ink-soft-dark">
                  {event.when.toLocaleDateString(locale, { month: "short", day: "numeric" })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <UploadMediaForm />

      {assets.length === 0 ? (
        <EmptyState icon={NavIcons.media} title={dict.media.noMedia} hint={dict.media.noMediaHint} />
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {assets.map((asset) => (
            <li key={asset.id} className="flex flex-col gap-2 rounded-lg border border-paper-border dark:border-night-border p-2">
              <div className="flex aspect-square items-center justify-center overflow-hidden rounded-md bg-paper-card dark:bg-night-card">
                {asset.storageDeletedAt ? (
                  // The real file is gone (cleanupMediaStorage ran after
                  // a re-render superseded it, or after a confirmed
                  // publish) — never attempt storage.url() on it, and
                  // never show the raw mimeType, which looks identical
                  // to a live asset's.
                  <span className="px-2 text-center text-xs text-ink-soft dark:text-ink-soft-dark">
                    {dict.media.noLongerAvailable}
                  </span>
                ) : asset.mimeType.startsWith("image/") ? (
                  <Image
                    src={storage.url(asset.storageKey)}
                    alt={asset.posterOutput?.headline ?? asset.videoOutput?.topic ?? asset.fileName}
                    width={asset.width ?? 300}
                    height={asset.height ?? 300}
                    className="h-full w-full object-cover"
                    unoptimized
                  />
                ) : (
                  <span className="text-xs text-ink-soft dark:text-ink-soft-dark">{asset.mimeType}</span>
                )}
              </div>
              <p className="truncate text-xs font-medium" title={asset.fileName}>
                {asset.fileName}
              </p>
              <p className="text-xs text-ink-soft dark:text-ink-soft-dark">
                {asset.width && asset.height ? `${asset.width}×${asset.height} · ` : ""}
                {formatBytes(asset.sizeBytes)}
              </p>
              {!asset.storageDeletedAt && asset.videoOutput && (
                <VideoEditModal
                  videoId={asset.videoOutput.id}
                  videoUrl={storage.url(asset.storageKey)}
                  hasNarration={asset.videoOutput.hasNarration}
                  script={asset.videoOutput.script as unknown as VideoScriptSections}
                  scenes={asset.videoOutput.scenes.map((scene) => ({
                    ...scene,
                    mediaAsset: scene.mediaAsset ? { id: scene.mediaAsset.id, fileName: scene.mediaAsset.fileName } : null,
                    thumbnailUrl: resolveSceneThumbnailUrl(scene),
                  }))}
                  sceneMediaAssets={sceneMediaAssets}
                />
              )}
              {!asset.storageDeletedAt && asset.posterOutput?.backgroundSource === "AI" && (
                <RegenerateBackgroundButton posterId={asset.posterOutput.id} />
              )}
              <form action={deleteMedia.bind(null, asset.id)}>
                <button
                  type="submit"
                  className="w-full rounded-md border border-paper-border dark:border-night-border bg-paper dark:bg-night-card px-2 py-1 text-xs font-medium text-ink-soft dark:text-ink-soft-dark"
                >
                  {dict.common.delete}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

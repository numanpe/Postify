import Image from "next/image";
import Link from "next/link";

import { requireCompany } from "@/lib/session";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { formatBytes } from "@/lib/format";
import { deleteMedia } from "@/lib/actions/media";
import { getPickableMediaAssets } from "@/lib/media";
import { getRealPublishTargets } from "@/lib/publish-targets";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { resolveSceneThumbnailUrl } from "@/lib/video/scene-thumbnails";
import { UploadMediaForm } from "@/components/media/upload-media-form";
import { EmptyState } from "@/components/empty-state";
import { NavIcons } from "@/components/icons";
import { PaginationNav } from "@/components/ui/pagination-nav";
import { VideoEditModal } from "@/components/campaign/video-edit-modal";
import { RegenerateBackgroundButton } from "@/components/poster/regenerate-background-button";
import { ShareAssetModal } from "@/components/media/share-asset-modal";
import { appendMusicCredit } from "@/lib/video/music-credit";
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

const ASSETS_PER_PAGE = 24;

export default async function MediaPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { company } = await requireCompany();
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const [assets, totalAssetCount, sceneMediaAssets, publishJobs, aggregatorLogs, failedItems, publishTargets] = await Promise.all([
    db.mediaAsset.findMany({
      where: { companyId: company.id },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * ASSETS_PER_PAGE,
      take: ASSETS_PER_PAGE,
      include: {
        videoOutput: {
          include: {
            scenes: {
              include: { mediaAsset: { select: { id: true, fileName: true, storageKey: true } } },
              orderBy: { order: "asc" },
            },
            // Share button's real caption/hashtag pre-fill when this
            // item came from a campaign — a Studio-standalone video has
            // none of these, and the Share form falls back to an empty,
            // user-typed caption, same honest gap createPublishJob's
            // own caption field already has for non-campaign items.
            campaignItem: { select: { captionText: true, angle: true, hashtags: true } },
          },
        },
        posterOutput: {
          include: {
            campaignItem: { select: { captionText: true, angle: true, hashtags: true } },
          },
        },
        brandKitLogo: true,
      },
    }),
    db.mediaAsset.count({ where: { companyId: company.id } }),
    // The video-edit modal's scene-swap picker needs the company's real
    // usable-media library, not just this page's 24 — deliberately a
    // separate query rather than derived from the paginated `assets`
    // above the way it used to be. Shared with every other real media
    // picker in the app (media.ts's own doc comment).
    getPickableMediaAssets(company.id, { includeVideo: true }),
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
    // Real connected-account listing for the Share button — the same
    // Direct SocialAccount + aggregator accountMap merge
    // campaign-publish-core.ts already reads, not a new source.
    getRealPublishTargets(company),
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
  const totalPages = Math.max(1, Math.ceil(totalAssetCount / ASSETS_PER_PAGE));

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

      {/* totalAssetCount, not assets.length — a real library that
          simply doesn't reach a manually-typed ?page=N shouldn't show
          the "upload your first asset" empty state. */}
      {totalAssetCount === 0 ? (
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
              {/* Part 1's real eligibility signal: posterOutput/
                  videoOutput present — a raw uploaded photo/video never
                  has either, so it never gets a Share button. */}
              {!asset.storageDeletedAt && asset.posterOutput && (
                <ShareAssetModal
                  assetKind="poster"
                  assetId={asset.posterOutput.id}
                  defaultCaption={
                    asset.posterOutput.campaignItem?.captionText ??
                    [asset.posterOutput.headline, asset.posterOutput.subhead, asset.posterOutput.cta]
                      .filter(Boolean)
                      .join("\n\n")
                  }
                  targets={publishTargets}
                  connectAccountsHref="/publish"
                />
              )}
              {!asset.storageDeletedAt && asset.videoOutput && (
                <ShareAssetModal
                  assetKind="video"
                  assetId={asset.videoOutput.id}
                  defaultCaption={
                    asset.videoOutput.campaignItem?.captionText ?? appendMusicCredit(asset.videoOutput.topic)
                  }
                  targets={publishTargets}
                  connectAccountsHref="/publish"
                />
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

      <PaginationNav
        currentPage={page}
        totalPages={totalPages}
        basePath="/media"
        previousLabel={dict.common.previousPage}
        nextLabel={dict.common.nextPage}
        indicatorLabel={dict.common.pageIndicator(page, totalPages)}
      />
    </div>
  );
}

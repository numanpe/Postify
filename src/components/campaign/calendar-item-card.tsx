import Image from "next/image";

import { storage } from "@/lib/storage";
import { resolveSceneThumbnailUrl } from "@/lib/video/scene-thumbnails";
import { approveCampaignItem, regenerateCampaignItem, removeCampaignItem } from "@/lib/actions/campaign";
import { extendMediaRetention } from "@/lib/actions/campaign-publish";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { platformLabel } from "@/lib/publish-targets";
import { DownloadCopyButton } from "./download-copy-button";
import { PublishViaAggregatorButton } from "./publish-via-aggregator-button";
import { PublishDirectButton } from "./publish-direct-button";
import { VideoEditModal, type VideoSceneForEdit, type SceneMediaAssetOption } from "./video-edit-modal";
import { SocialPreviewModal } from "@/components/social-preview/social-preview-modal";
import { ActionIcons, NavIcons } from "@/components/icons";
import type { CampaignAssetType, CampaignItemStatus, SocialPlatform } from "@prisma/client";
import type { VideoScriptSections } from "@/lib/providers/text/types";

const STATUS_STYLES: Record<CampaignItemStatus, string> = {
  PENDING: "bg-paper-card dark:bg-night-card text-ink-soft dark:text-ink-soft-dark",
  GENERATING: "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400",
  READY: "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400",
  FAILED: "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400",
  APPROVED: "bg-green-600 text-white",
};

interface MediaAssetInfo {
  id: string;
  storageKey: string;
  width: number | null;
  height: number | null;
  storageDeletedAt: Date | null;
  staleFlaggedAt: Date | null;
}

interface CalendarItemCardProps {
  item: {
    id: string;
    campaignId: string;
    angle: string;
    assetType: CampaignAssetType;
    status: CampaignItemStatus;
    errorMessage: string | null;
    captionText: string | null;
    hashtags: string[];
    targetPlatforms: SocialPlatform[];
    // publishJobs: real, sufficient evidence a Direct-API auto-publish
    // attempt already happened for this item (see the "already
    // attempted" fix below) — publishCampaignItemDirectForCompany only
    // ever creates one when it genuinely attempts a publish, success or
    // failure, so its mere existence (any status) is the signal, not a
    // specific status value.
    poster: { asset: MediaAssetInfo; publishJobs: { id: string }[] } | null;
    video:
      | {
          id: string;
          hasNarration: boolean;
          // Real type is Prisma's Json column — cast at the VideoEditModal
          // call site below, same pattern this app already uses for other
          // Json fields (e.g. CreativeDna.confidenceScores).
          script: unknown;
          asset: MediaAssetInfo;
          // Raw shape from the page's Prisma query — mapped to
          // VideoSceneForEdit (resolving thumbnailUrl) just below, not
          // passed straight through.
          scenes: (Omit<VideoSceneForEdit, "mediaAsset" | "thumbnailUrl"> & {
            mediaAsset: { id: string; fileName: string; storageKey: string } | null;
            thumbnailStorageKey: string | null;
          })[];
        }
      | null;
    aggregatorPublishLogs: { succeeded: boolean; errorMessage: string | null }[];
  };
  connectedAccounts: { id: string; platform: SocialPlatform; displayName: string }[];
  aggregatorConfigured: boolean;
  aggregatorProviderName: string | null;
  retentionDays: number;
  companyName: string;
  companyLogoUrl: string | null;
  sceneMediaAssets: SceneMediaAssetOption[];
  // Set only when this item belongs to an active, auto-publish recurring
  // plan (src/lib/jobs/process-recurring-plans.ts) — the "persistently
  // visible, never something a user could forget is active" requirement
  // for auto-publish, right on the item it actually applies to.
  autoPublishAt?: Date | null;
}

// Server component — the "Manage" disclosure is a native <details>
// element and every action is a plain bound server action form, so no
// client-side state is needed for most of what's an otherwise fully
// interactive card (approve / edit + regenerate / remove / the two
// server-side publish paths). Only Download & Copy needs real client JS
// (clipboard + triggering a file download), so that one piece is the
// small DownloadCopyButton client component.
export async function CalendarItemCard({
  item,
  connectedAccounts,
  aggregatorConfigured,
  aggregatorProviderName,
  retentionDays,
  companyName,
  companyLogoUrl,
  sceneMediaAssets,
  autoPublishAt,
}: CalendarItemCardProps) {
  const dict = getDictionary(await getLocale());
  const pubDict = dict.publishing;

  const mediaAsset = item.poster?.asset ?? item.video?.asset ?? null;
  const fileAvailable = !!mediaAsset && !mediaAsset.storageDeletedAt;
  const lastLog = item.aggregatorPublishLogs[0];
  const eligibleAccounts = connectedAccounts.filter(
    (a) => item.targetPlatforms.length === 0 || item.targetPlatforms.includes(a.platform),
  );
  // Real bug fixed here: "Will auto-publish at HH:MM" used to keep
  // showing forever after the scheduled time passed, even once a real
  // attempt had already resolved — success, failure, or the
  // targetPlatforms-mismatch case fixed in process-recurring-plans.ts.
  // status alone can't tell "not yet attempted" from "already
  // attempted" apart (autoPublishReadyItems never moves a POSTER/video
  // item off APPROVED either way — see that file's own comment on why
  // FAILED is deliberately not used), so this checks the real evidence
  // an attempt happened instead: an aggregator log row, an errorMessage
  // (the mismatch case), or an actual PublishJob (the Direct case,
  // success or failure — its mere existence is the signal).
  const autoPublishAlreadyAttempted = Boolean(lastLog) || Boolean(item.errorMessage) || (item.poster?.publishJobs.length ?? 0) > 0;

  return (
    <div
      data-campaign-item-id={item.id}
      className="flex flex-col gap-1 rounded-md border border-paper-border dark:border-night-border bg-paper dark:bg-night-card p-1.5 text-xs"
    >
      <div className="flex items-center gap-1">
        <span className={`w-fit rounded px-1.5 py-0.5 font-medium ${STATUS_STYLES[item.status]}`}>
          {dict.status[item.status]}
        </span>
        <span className="w-fit rounded border border-paper-border dark:border-night-border px-1.5 py-0.5 text-ink-soft dark:text-ink-soft-dark">
          {item.assetType === "VIDEO" ? dict.campaigns.assetTypeVideo : dict.campaigns.assetTypePoster}
        </span>
      </div>

      {autoPublishAt && !autoPublishAlreadyAttempted && (item.status === "READY" || item.status === "APPROVED") && (
        <p className="text-amber-700 dark:text-amber-400">
          {dict.recurringPlan.autoPublishItemLabel(autoPublishAt.toISOString().slice(11, 16))}
        </p>
      )}

      {fileAvailable && item.poster?.asset && (
        <Image
          src={storage.url(item.poster.asset.storageKey)}
          alt={item.angle}
          width={item.poster.asset.width ?? 200}
          height={item.poster.asset.height ?? 200}
          className="aspect-square w-full rounded object-cover"
          unoptimized
        />
      )}

      {fileAvailable && item.video?.asset && (
        // Burned-in captions are already part of the rendered video itself.
        <video
          src={storage.url(item.video.asset.storageKey)}
          controls
          muted
          className="aspect-square w-full rounded bg-black object-cover"
        />
      )}

      {mediaAsset && !fileAvailable && (
        <p className="rounded bg-paper-card dark:bg-night-card p-2 text-center text-ink-soft dark:text-ink-soft-dark">
          {pubDict.fileCleanedUp}
        </p>
      )}

      {mediaAsset?.staleFlaggedAt && fileAvailable && (
        <div className="flex flex-col gap-1 rounded border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 p-1.5 text-amber-800 dark:text-amber-300">
          <p>{pubDict.staleWarning(retentionDays)}</p>
          <form action={extendMediaRetention.bind(null, mediaAsset.id, item.campaignId)}>
            <button type="submit" className="underline">
              {pubDict.extendRetention}
            </button>
          </form>
        </div>
      )}

      <p className="line-clamp-2 text-ink-soft dark:text-ink-soft-dark" title={item.angle}>
        {item.angle}
      </p>

      {item.captionText && (item.status === "READY" || item.status === "APPROVED") && (
        <details>
          <summary className="cursor-pointer text-ink-soft dark:text-ink-soft-dark">{dict.campaigns.captionLabel}</summary>
          <p className="mt-1 whitespace-pre-wrap">{item.captionText}</p>
          {item.hashtags.length > 0 && (
            <p className="mt-1 text-ink-soft dark:text-ink-soft-dark">{item.hashtags.join(" ")}</p>
          )}
        </details>
      )}

      {item.errorMessage && (
        <p className="text-red-600 dark:text-red-400" title={item.errorMessage}>
          {item.errorMessage.length > 40 ? `${item.errorMessage.slice(0, 40)}…` : item.errorMessage}
        </p>
      )}

      {lastLog && (
        <p className={lastLog.succeeded ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
          {lastLog.succeeded ? pubDict.lastAttemptSucceeded : pubDict.lastAttemptFailed(lastLog.errorMessage ?? "")}
        </p>
      )}

      <details>
        <summary className="cursor-pointer text-ink-soft dark:text-ink-soft-dark">{dict.common.manage}</summary>
        <div className="mt-1 flex flex-col gap-1">
          {item.status === "READY" && (
            <form action={approveCampaignItem.bind(null, item.id)}>
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-1.5 rounded bg-primary px-1.5 py-0.5 text-paper dark:bg-primary-dark dark:text-night"
              >
                <ActionIcons.approve size={14} aria-hidden="true" />
                {dict.common.approve}
              </button>
            </form>
          )}

          {fileAvailable && (
            <DownloadCopyButton itemId={item.id} captionText={item.captionText} hashtags={item.hashtags} />
          )}

          {fileAvailable && mediaAsset && mediaAsset.width && mediaAsset.height && (
            <SocialPreviewModal
              mediaUrl={storage.url(mediaAsset.storageKey)}
              mediaType={item.assetType === "VIDEO" ? "video" : "image"}
              mediaWidth={mediaAsset.width}
              mediaHeight={mediaAsset.height}
              companyName={companyName}
              logoUrl={companyLogoUrl}
              captionText={item.captionText}
              hashtags={item.hashtags}
            />
          )}

          {fileAvailable && item.assetType === "VIDEO" && item.video?.asset && (
            <VideoEditModal
              videoId={item.video.id}
              videoUrl={storage.url(item.video.asset.storageKey)}
              hasNarration={item.video.hasNarration}
              script={item.video.script as VideoScriptSections}
              scenes={item.video.scenes.map((scene) => ({
                ...scene,
                mediaAsset: scene.mediaAsset ? { id: scene.mediaAsset.id, fileName: scene.mediaAsset.fileName } : null,
                thumbnailUrl: resolveSceneThumbnailUrl(scene),
              }))}
              sceneMediaAssets={sceneMediaAssets}
            />
          )}

          {fileAvailable &&
            (aggregatorConfigured && aggregatorProviderName ? (
              <PublishViaAggregatorButton itemId={item.id} providerName={aggregatorProviderName} />
            ) : (
              <a href="/settings" className="inline-flex items-center gap-1.5 text-ink-soft dark:text-ink-soft-dark underline">
                <NavIcons.settings size={14} aria-hidden="true" />
                {pubDict.modeAggregatorTitle}
              </a>
            ))}

          {fileAvailable && item.assetType === "POSTER" && (
            eligibleAccounts.length > 0 ? (
              <PublishDirectButton itemId={item.id} accounts={eligibleAccounts} />
            ) : connectedAccounts.length > 0 ? (
              // Real bug found while auditing other publish surfaces for
              // the ShareAssetModal eligibility-messaging fix: this used
              // to show the same "connect an account" copy even when a
              // real Direct account IS connected — just for a platform
              // this item's own targetPlatforms (set at generation time
              // from whichever accounts were connected then, see
              // CampaignItem.targetPlatforms's own schema comment)
              // doesn't include, e.g. after switching which account is
              // connected. Honest, distinct copy naming the real gap
              // instead of implying nothing is connected at all.
              <p className="text-ink-soft dark:text-ink-soft-dark">
                {pubDict.noMatchingAccountForDirect(item.targetPlatforms.map((p) => platformLabel(dict, p)).join(", "))}
              </p>
            ) : (
              <p className="text-ink-soft dark:text-ink-soft-dark">{pubDict.noAccountsForDirect}</p>
            )
          )}

          <form action={regenerateCampaignItem.bind(null, item.id)} className="flex flex-col gap-1">
            <textarea
              name="angle"
              defaultValue={item.angle}
              rows={2}
              aria-label={dict.campaigns.angleLabel}
              className="rounded border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-1 py-0.5 text-base"
            />
            <button type="submit" className="inline-flex w-full items-center justify-center gap-1.5 rounded border border-paper-border dark:border-night-border px-1.5 py-0.5">
              {item.status === "FAILED" ? (
                <ActionIcons.retry size={14} aria-hidden="true" />
              ) : (
                <ActionIcons.regenerate size={14} aria-hidden="true" />
              )}
              {item.status === "FAILED" ? dict.common.retry : dict.common.regenerate}
            </button>
          </form>

          <form action={removeCampaignItem.bind(null, item.id)}>
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded border border-paper-border dark:border-night-border px-1.5 py-0.5 text-red-600 dark:text-red-400"
            >
              <ActionIcons.remove size={14} aria-hidden="true" />
              {dict.common.remove}
            </button>
          </form>
        </div>
      </details>
    </div>
  );
}

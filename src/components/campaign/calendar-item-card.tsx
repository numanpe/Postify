import Image from "next/image";

import { storage } from "@/lib/storage";
import { approveCampaignItem, regenerateCampaignItem, removeCampaignItem } from "@/lib/actions/campaign";
import {
  publishCampaignItemViaAggregator,
  publishCampaignItemDirect,
  extendMediaRetention,
} from "@/lib/actions/campaign-publish";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { DownloadCopyButton } from "./download-copy-button";
import type { CampaignAssetType, CampaignItemStatus, SocialPlatform } from "@prisma/client";

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
    poster: { asset: MediaAssetInfo } | null;
    video: { asset: MediaAssetInfo } | null;
    aggregatorPublishLogs: { succeeded: boolean; errorMessage: string | null }[];
  };
  connectedAccounts: { id: string; platform: SocialPlatform; displayName: string }[];
  aggregatorConfigured: boolean;
  aggregatorProviderName: string | null;
  retentionDays: number;
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
}: CalendarItemCardProps) {
  const dict = getDictionary(await getLocale());
  const pubDict = dict.publishing;

  const mediaAsset = item.poster?.asset ?? item.video?.asset ?? null;
  const fileAvailable = !!mediaAsset && !mediaAsset.storageDeletedAt;
  const lastLog = item.aggregatorPublishLogs[0];
  const eligibleAccounts = connectedAccounts.filter(
    (a) => item.targetPlatforms.length === 0 || item.targetPlatforms.includes(a.platform),
  );

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
                className="w-full rounded bg-primary px-1.5 py-0.5 text-paper dark:bg-primary-dark dark:text-night"
              >
                {dict.common.approve}
              </button>
            </form>
          )}

          {fileAvailable && (
            <DownloadCopyButton itemId={item.id} captionText={item.captionText} hashtags={item.hashtags} />
          )}

          {fileAvailable &&
            (aggregatorConfigured && aggregatorProviderName ? (
              <form action={publishCampaignItemViaAggregator.bind(null, item.id)}>
                <button
                  type="submit"
                  className="w-full rounded border border-paper-border dark:border-night-border px-1.5 py-0.5"
                >
                  {pubDict.publishViaProvider(aggregatorProviderName)}
                </button>
              </form>
            ) : (
              <a href="/settings" className="text-ink-soft dark:text-ink-soft-dark underline">
                {pubDict.modeAggregatorTitle}
              </a>
            ))}

          {fileAvailable && item.assetType === "POSTER" && (
            eligibleAccounts.length > 0 ? (
              <form action={publishCampaignItemDirect.bind(null, item.id)} className="flex flex-col gap-1">
                <select
                  name="socialAccountId"
                  required
                  className="rounded border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-1 py-0.5"
                >
                  {eligibleAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.displayName}
                    </option>
                  ))}
                </select>
                <button type="submit" className="w-full rounded border border-paper-border dark:border-night-border px-1.5 py-0.5">
                  {pubDict.publishDirect}
                </button>
              </form>
            ) : (
              <p className="text-ink-soft dark:text-ink-soft-dark">{pubDict.noAccountsForDirect}</p>
            )
          )}

          <form action={regenerateCampaignItem.bind(null, item.id)} className="flex flex-col gap-1">
            <textarea
              name="angle"
              defaultValue={item.angle}
              rows={2}
              className="rounded border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-1 py-0.5"
            />
            <button type="submit" className="rounded border border-paper-border dark:border-night-border px-1.5 py-0.5">
              {item.status === "FAILED" ? dict.common.retry : dict.common.regenerate}
            </button>
          </form>

          <form action={removeCampaignItem.bind(null, item.id)}>
            <button
              type="submit"
              className="w-full rounded border border-paper-border dark:border-night-border px-1.5 py-0.5 text-red-600 dark:text-red-400"
            >
              {dict.common.remove}
            </button>
          </form>
        </div>
      </details>
    </div>
  );
}

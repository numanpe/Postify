"use client";

import { useActionState, useRef, useState } from "react";

import { createPublishJob, suggestPublishTime } from "@/lib/actions/publish";
import { isVideoOnlyPlatform } from "@/lib/providers/social/platform-status";
import { appendMusicCredit } from "@/lib/video/music-credit";
import { Button } from "@/components/ui/button";
import { useDict } from "@/components/i18n/locale-provider";

interface SocialAccountOption {
  id: string;
  platform: string;
  displayName: string;
}

interface PosterOption {
  id: string;
  headline: string;
  subhead: string | null;
  cta: string | null;
}

interface VideoOption {
  id: string;
  topic: string;
}

export function CreatePublishJobForm({
  accounts,
  posters,
  videos = [],
}: {
  accounts: SocialAccountOption[];
  posters: PosterOption[];
  videos?: VideoOption[];
}) {
  const [state, action, pending] = useActionState(createPublishJob, undefined);
  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id ?? "");
  const [selectedPosterId, setSelectedPosterId] = useState(posters[0]?.id ?? "");
  const [selectedVideoId, setSelectedVideoId] = useState(videos[0]?.id ?? "");
  const [autoScheduling, setAutoScheduling] = useState(false);
  const [autoScheduleNote, setAutoScheduleNote] = useState<string | null>(null);
  const scheduledForRef = useRef<HTMLInputElement>(null);
  const dict = useDict().publish;
  const platformLabels: Record<string, string> = {
    FACEBOOK: dict.platformFacebook,
    INSTAGRAM: dict.platformInstagram,
    LINKEDIN: dict.platformLinkedIn,
    TIKTOK: dict.platformTikTok,
  };

  const selectedAccount = accounts.find((account) => account.id === selectedAccountId);
  const needsVideo = selectedAccount ? isVideoOnlyPlatform(selectedAccount.platform) : false;

  const selectedPoster = posters.find((poster) => poster.id === selectedPosterId);
  const selectedVideo = videos.find((video) => video.id === selectedVideoId);
  const suggestedCaption = needsVideo
    ? (selectedVideo ? appendMusicCredit(selectedVideo.topic) : "")
    : selectedPoster
      ? [selectedPoster.headline, selectedPoster.subhead, selectedPoster.cta].filter(Boolean).join("\n\n")
      : "";

  return (
    <form action={action} className="flex w-full max-w-md flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="socialAccountId" className="text-sm font-medium">
          {dict.publishTo}
        </label>
        <select
          id="socialAccountId"
          name="socialAccountId"
          required
          value={selectedAccountId}
          onChange={(event) => setSelectedAccountId(event.target.value)}
          className="rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-3 py-2 text-base"
        >
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {platformLabels[account.platform] ?? account.platform} — {account.displayName}
            </option>
          ))}
        </select>
      </div>

      {needsVideo ? (
        <div className="flex flex-col gap-1">
          <label htmlFor="videoId" className="text-sm font-medium">
            {dict.video}
          </label>
          <select
            id="videoId"
            name="videoId"
            required
            value={selectedVideoId}
            onChange={(event) => setSelectedVideoId(event.target.value)}
            className="rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-3 py-2 text-base"
          >
            {videos.map((video) => (
              <option key={video.id} value={video.id}>
                {video.topic}
              </option>
            ))}
          </select>
          {videos.length === 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400">{dict.noVideosYet}</p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <label htmlFor="posterId" className="text-sm font-medium">
            {dict.poster}
          </label>
          <select
            id="posterId"
            name="posterId"
            required
            value={selectedPosterId}
            onChange={(event) => setSelectedPosterId(event.target.value)}
            className="rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-3 py-2 text-base"
          >
            {posters.map((poster) => (
              <option key={poster.id} value={poster.id}>
                {poster.headline}
              </option>
            ))}
          </select>
          {/* Real bug found while auditing other publish surfaces for
              the ShareAssetModal eligibility-messaging fix: this branch
              never had the videos branch's equivalent empty-state
              warning, so a company with a real connected Direct
              Facebook/Instagram account but zero posters (e.g. only
              videos generated so far) got a silently empty required
              <select> with no explanation. */}
          {posters.length === 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400">{dict.noPostersYetInline}</p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="caption" className="text-sm font-medium">
          {dict.caption}
        </label>
        <textarea
          id="caption"
          name="caption"
          key={needsVideo ? selectedVideoId : selectedPosterId}
          required
          rows={4}
          maxLength={2200}
          defaultValue={suggestedCaption}
          className="rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-3 py-2 text-base"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="scheduledFor" className="text-sm font-medium">
          {dict.when} <span className="font-normal text-ink-soft dark:text-ink-soft-dark">{dict.whenHint}</span>
        </label>
        <div className="flex gap-2">
          <input
            ref={scheduledForRef}
            id="scheduledFor"
            name="scheduledFor"
            type="datetime-local"
            className="flex-1 rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-3 py-2 text-base"
          />
          <button
            type="button"
            disabled={autoScheduling}
            onClick={async () => {
              setAutoScheduling(true);
              setAutoScheduleNote(null);
              try {
                const suggestion = await suggestPublishTime();
                if (scheduledForRef.current) scheduledForRef.current.value = suggestion.value;
                setAutoScheduleNote(
                  suggestion.source === "learned" && suggestion.sampleSize
                    ? dict.autoScheduleAppliedLearned(suggestion.sampleSize)
                    : dict.autoScheduleAppliedDefault,
                );
              } finally {
                setAutoScheduling(false);
              }
            }}
            className="shrink-0 rounded-md border border-paper-border dark:border-night-border px-3 py-2 text-sm font-medium hover:bg-paper-card dark:hover:bg-night-card disabled:cursor-not-allowed disabled:opacity-60"
          >
            {autoScheduling ? dict.autoScheduling : dict.autoSchedule}
          </button>
        </div>
        {autoScheduleNote && <p className="text-xs text-ink-soft dark:text-ink-soft-dark">{autoScheduleNote}</p>}
      </div>

      {state?.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}

      <Button type="submit" pending={pending} pendingLabel={dict.queuing}>
        {dict.queuePost}
      </Button>
    </form>
  );
}

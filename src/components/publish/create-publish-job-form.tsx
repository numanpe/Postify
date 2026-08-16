"use client";

import { useActionState, useState } from "react";

import { createPublishJob } from "@/lib/actions/publish";
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

export function CreatePublishJobForm({
  accounts,
  posters,
}: {
  accounts: SocialAccountOption[];
  posters: PosterOption[];
}) {
  const [state, action, pending] = useActionState(createPublishJob, undefined);
  const [selectedPosterId, setSelectedPosterId] = useState(posters[0]?.id ?? "");
  const dict = useDict().publish;
  const platformLabels: Record<string, string> = {
    FACEBOOK: dict.platformFacebook,
    INSTAGRAM: dict.platformInstagram,
  };

  const selectedPoster = posters.find((poster) => poster.id === selectedPosterId);
  const suggestedCaption = selectedPoster
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
          className="rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-3 py-2 text-base"
        >
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {platformLabels[account.platform] ?? account.platform} — {account.displayName}
            </option>
          ))}
        </select>
      </div>

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
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="caption" className="text-sm font-medium">
          {dict.caption}
        </label>
        <textarea
          id="caption"
          name="caption"
          key={selectedPosterId}
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
        <input
          id="scheduledFor"
          name="scheduledFor"
          type="datetime-local"
          className="rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-3 py-2 text-base"
        />
      </div>

      {state?.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}

      <Button type="submit" pending={pending} pendingLabel={dict.queuing}>
        {dict.queuePost}
      </Button>
    </form>
  );
}

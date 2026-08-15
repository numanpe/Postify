"use client";

import { useActionState } from "react";

import { generatePoster } from "@/lib/actions/poster";
import { Button } from "@/components/ui/button";

interface PhotoAsset {
  id: string;
  fileName: string;
}

export function PosterForm({ photoAssets }: { photoAssets: PhotoAsset[] }) {
  const [state, action, pending] = useActionState(generatePoster, undefined);

  return (
    <form action={action} className="flex w-full max-w-md flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="headline" className="text-sm font-medium">
          Headline
        </label>
        <input
          id="headline"
          name="headline"
          required
          maxLength={70}
          className="rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-3 py-2 text-base"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="subhead" className="text-sm font-medium">
          Subhead <span className="font-normal text-ink-soft dark:text-ink-soft-dark">(optional)</span>
        </label>
        <input
          id="subhead"
          name="subhead"
          maxLength={120}
          className="rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-3 py-2 text-base"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="cta" className="text-sm font-medium">
          Call to action <span className="font-normal text-ink-soft dark:text-ink-soft-dark">(optional)</span>
        </label>
        <input
          id="cta"
          name="cta"
          maxLength={30}
          placeholder="e.g. Shop now"
          className="rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-3 py-2 text-base"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="aspectRatio" className="text-sm font-medium">
          Format
        </label>
        <select
          id="aspectRatio"
          name="aspectRatio"
          defaultValue="SQUARE"
          className="rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-3 py-2 text-base"
        >
          <option value="SQUARE">Square (1:1)</option>
          <option value="STORY">Story (9:16)</option>
          <option value="LANDSCAPE">Landscape (16:9)</option>
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="backgroundSource" className="text-sm font-medium">
          Background
        </label>
        <select
          id="backgroundSource"
          name="backgroundSource"
          defaultValue="BRAND"
          className="rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-3 py-2 text-base"
        >
          <option value="BRAND">Brand gradient (free)</option>
          <option value="PHOTO">A photo from Media Library</option>
          <option value="AI">AI-generated (needs an OpenAI key in Settings)</option>
        </select>
      </div>

      {photoAssets.length > 0 && (
        <div className="flex flex-col gap-1">
          <label htmlFor="backgroundAssetId" className="text-sm font-medium">
            Photo{" "}
            <span className="font-normal text-ink-soft dark:text-ink-soft-dark">
              (used only when Background is set to &quot;A photo&quot;)
            </span>
          </label>
          <select
            id="backgroundAssetId"
            name="backgroundAssetId"
            className="rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-3 py-2 text-base"
          >
            {photoAssets.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.fileName}
              </option>
            ))}
          </select>
        </div>
      )}

      {state?.status === "error" && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
      {state?.status === "success" && state.warnings.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm text-amber-600 dark:text-amber-400">
          {state.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}
      {state?.status === "success" && (
        <p className="text-sm text-green-700 dark:text-green-400">Poster generated — see it below.</p>
      )}

      <Button type="submit" pending={pending} pendingLabel="Generating…">
        Generate poster
      </Button>
    </form>
  );
}

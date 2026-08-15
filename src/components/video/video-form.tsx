"use client";

import { useActionState } from "react";

import { generateVideo } from "@/lib/actions/video";
import { Button } from "@/components/ui/button";

interface MediaAssetOption {
  id: string;
  fileName: string;
  mimeType: string;
}

export function VideoForm({
  assets,
  hasOpenAiKey,
}: {
  assets: MediaAssetOption[];
  hasOpenAiKey: boolean;
}) {
  const [state, action, pending] = useActionState(generateVideo, undefined);

  return (
    <form action={action} className="flex w-full max-w-md flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="topic" className="text-sm font-medium">
          What&apos;s this video about?
        </label>
        <input
          id="topic"
          name="topic"
          required
          placeholder="e.g. our new spring menu"
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
          defaultValue="STORY"
          className="rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-3 py-2 text-base"
        >
          <option value="SQUARE">Square (1:1)</option>
          <option value="STORY">Story / Reel (9:16)</option>
          <option value="LANDSCAPE">Landscape (16:9)</option>
        </select>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="useNarration" disabled={!hasOpenAiKey} />
        Add spoken narration
        {!hasOpenAiKey && (
          <span className="text-ink-soft dark:text-ink-soft-dark">(needs an OpenAI key in Settings)</span>
        )}
      </label>

      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium">
          Footage{" "}
          <span className="font-normal text-ink-soft dark:text-ink-soft-dark">
            (pick up to 5 — used in the order listed below)
          </span>
        </span>
        {assets.length === 0 ? (
          <p className="text-sm text-ink-soft dark:text-ink-soft-dark">
            No photos or videos uploaded yet — visit Media Library first, or rely on AI-generated
            visuals if an OpenAI key is configured.
          </p>
        ) : (
          <ul className="flex flex-col gap-1 rounded-md border border-paper-border dark:border-night-border p-2">
            {assets.map((asset) => (
              <li key={asset.id}>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="assetIds" value={asset.id} />
                  <span className="truncate">{asset.fileName}</span>
                  <span className="text-xs text-ink-soft dark:text-ink-soft-dark">
                    {asset.mimeType.startsWith("video/") ? "video" : "photo"}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>

      {state?.status === "error" && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
      {state?.status === "success" && (
        <div className="flex flex-col gap-1">
          <p className="text-sm text-green-700 dark:text-green-400">Video generated — see it below.</p>
          {state.warnings.map((warning) => (
            <p key={warning} className="text-sm text-amber-600 dark:text-amber-400">
              {warning}
            </p>
          ))}
        </div>
      )}

      <Button type="submit" pending={pending} pendingLabel="Generating… this can take a minute">
        Generate video
      </Button>
    </form>
  );
}

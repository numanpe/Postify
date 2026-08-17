"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { generateVideo } from "@/lib/actions/video";
import { Button } from "@/components/ui/button";
import { useDict } from "@/components/i18n/locale-provider";

interface MediaAssetOption {
  id: string;
  fileName: string;
  mimeType: string;
}

export function VideoForm({
  assets,
  narrationAvailable,
}: {
  assets: MediaAssetOption[];
  narrationAvailable: boolean;
}) {
  const [state, action, pending] = useActionState(generateVideo, undefined);
  const dict = useDict().video;
  const router = useRouter();

  // See poster-form.tsx's identical effect — client-side refresh
  // instead of the server calling revalidatePath.
  useEffect(() => {
    if (state?.status === "success") {
      router.refresh();
    }
  }, [state, router]);

  return (
    <form action={action} className="flex w-full max-w-md flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="topic" className="text-sm font-medium">
          {dict.topic}
        </label>
        <input
          id="topic"
          name="topic"
          required
          placeholder={dict.topicPlaceholder}
          className="rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-3 py-2 text-base"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="aspectRatio" className="text-sm font-medium">
          {dict.format}
        </label>
        <select
          id="aspectRatio"
          name="aspectRatio"
          defaultValue="STORY"
          className="rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-3 py-2 text-base"
        >
          <option value="SQUARE">{dict.formatSquare}</option>
          <option value="STORY">{dict.formatStory}</option>
          <option value="LANDSCAPE">{dict.formatLandscape}</option>
        </select>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="useNarration" defaultChecked={narrationAvailable} disabled={!narrationAvailable} />
        {dict.narration}
        {!narrationAvailable && <span className="text-ink-soft dark:text-ink-soft-dark">{dict.narrationHint}</span>}
      </label>

      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium">
          {dict.footage} <span className="font-normal text-ink-soft dark:text-ink-soft-dark">{dict.footageHint}</span>
        </span>
        {assets.length === 0 ? (
          <p className="text-sm text-ink-soft dark:text-ink-soft-dark">{dict.noFootage}</p>
        ) : (
          <ul className="flex flex-col gap-1 rounded-md border border-paper-border dark:border-night-border p-2">
            {assets.map((asset) => (
              <li key={asset.id}>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="assetIds" value={asset.id} />
                  <span className="truncate">{asset.fileName}</span>
                  <span className="text-xs text-ink-soft dark:text-ink-soft-dark">
                    {asset.mimeType.startsWith("video/") ? dict.kindVideo : dict.kindPhoto}
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
          <p className="text-sm text-green-700 dark:text-green-400">{dict.generatedSuccess}</p>
          {state.warnings.map((warning) => (
            <p key={warning} className="text-sm text-amber-600 dark:text-amber-400">
              {warning}
            </p>
          ))}
        </div>
      )}

      <Button type="submit" pending={pending} pendingLabel={dict.generating}>
        {dict.generate}
      </Button>
    </form>
  );
}

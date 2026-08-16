"use client";

import { useActionState } from "react";

import { generatePoster } from "@/lib/actions/poster";
import { Button } from "@/components/ui/button";
import { useDict } from "@/components/i18n/locale-provider";

interface PhotoAsset {
  id: string;
  fileName: string;
}

export function PosterForm({ photoAssets }: { photoAssets: PhotoAsset[] }) {
  const [state, action, pending] = useActionState(generatePoster, undefined);
  const dict = useDict().poster;
  const common = useDict().common;

  return (
    <form action={action} className="flex w-full max-w-md flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="headline" className="text-sm font-medium">
          {dict.headline}
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
          {dict.subhead} <span className="font-normal text-ink-soft dark:text-ink-soft-dark">{common.optional}</span>
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
          {dict.cta} <span className="font-normal text-ink-soft dark:text-ink-soft-dark">{common.optional}</span>
        </label>
        <input
          id="cta"
          name="cta"
          maxLength={30}
          placeholder={dict.ctaPlaceholder}
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
          defaultValue="SQUARE"
          className="rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-3 py-2 text-base"
        >
          <option value="SQUARE">{dict.formatSquare}</option>
          <option value="STORY">{dict.formatStory}</option>
          <option value="LANDSCAPE">{dict.formatLandscape}</option>
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="backgroundSource" className="text-sm font-medium">
          {dict.background}
        </label>
        <select
          id="backgroundSource"
          name="backgroundSource"
          defaultValue="BRAND"
          className="rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-3 py-2 text-base"
        >
          <option value="BRAND">{dict.backgroundBrand}</option>
          <option value="PHOTO">{dict.backgroundPhoto}</option>
          <option value="AI">{dict.backgroundAI}</option>
        </select>
      </div>

      {photoAssets.length > 0 && (
        <div className="flex flex-col gap-1">
          <label htmlFor="backgroundAssetId" className="text-sm font-medium">
            {dict.photo} <span className="font-normal text-ink-soft dark:text-ink-soft-dark">{dict.photoHint}</span>
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
        <p className="text-sm text-green-700 dark:text-green-400">{dict.generatedSuccess}</p>
      )}

      <Button type="submit" pending={pending} pendingLabel={dict.generating}>
        {dict.generate}
      </Button>
    </form>
  );
}

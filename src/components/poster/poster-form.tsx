"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { generatePoster } from "@/lib/actions/poster";
import { Button } from "@/components/ui/button";
import { useDict } from "@/components/i18n/locale-provider";
import { NavIcons } from "@/components/icons";
import { TEMPLATE_IDS } from "@/lib/poster/template-ids";

interface PhotoAsset {
  id: string;
  fileName: string;
}

export function PosterForm({
  photoAssets,
  defaultBackgroundSource,
  defaultHeadline,
  onSuccess,
  preferredTemplateOrder,
}: {
  photoAssets: PhotoAsset[];
  // Computed server-side (see poster/page.tsx): PHOTO with the most
  // recent upload pre-selected when the company has usable photos,
  // otherwise BRAND — a real business owner's uploaded product/site
  // photos beat a generic gradient by default, without removing the
  // choice to use the gradient or AI instead.
  defaultBackgroundSource: "BRAND" | "PHOTO";
  // Carried over from the Step 1 wizard's chosen caption (studio/page.tsx)
  // when arriving via "Next: Create Asset" — still just a starting
  // point in a real, editable field, not a locked-in value.
  defaultHeadline?: string;
  // Wizard Step 2 (wizard-step2.tsx) needs the new poster's id to
  // advance to Step 3 — this form still owns generation/success state
  // internally, so it's a callback rather than the parent trying to
  // reach into this component's state.
  onSuccess?: (posterId: string) => void;
  // Real accumulated delete/publish/regenerate preference (Creative
  // DNA's template-preference.ts), computed server-side — the
  // highest-weighted template becomes the default selection, but every
  // template stays fully visible and selectable regardless of order or
  // weight (Part 1.3's "never collapse to nothing" floor is enforced
  // where this was computed, not here). Falls back to TEMPLATE_IDS'
  // fixed order when there isn't enough evidence yet (a brand-new
  // company, or fewer than the minimum sample size for every template).
  preferredTemplateOrder?: readonly string[];
}) {
  const [state, action, pending] = useActionState(generatePoster, undefined);
  const dict = useDict().poster;
  const common = useDict().common;
  const router = useRouter();

  const orderedTemplateIds =
    preferredTemplateOrder && preferredTemplateOrder.length === TEMPLATE_IDS.length
      ? (preferredTemplateOrder as (typeof TEMPLATE_IDS)[number][])
      : TEMPLATE_IDS;

  // Refreshes the previous-posters list client-side instead of the
  // server calling revalidatePath — same "show the new poster without
  // a manual reload" result, but as a normal fetch rather than a
  // metered cache-invalidation write (see generate.ts's history).
  useEffect(() => {
    if (state?.status === "success") {
      router.refresh();
      onSuccess?.(state.posterId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onSuccess is a fresh closure each render; only re-run when state/router actually change
  }, [state, router]);

  const templateNames: Record<(typeof TEMPLATE_IDS)[number], string> = {
    MINIMAL: dict.templateMinimalName,
    BOLD_HEADLINE: dict.templateBoldHeadlineName,
    PROMOTIONAL_BANNER: dict.templatePromotionalBannerName,
    SPLIT_PRODUCT: dict.templateSplitProductName,
    MODERN_BANNER: dict.templateModernBannerName,
    BADGE_OFFER: dict.templateBadgeOfferName,
    MINIMALIST_FRAME: dict.templateMinimalistFrameName,
  };
  const templateDescriptions: Record<(typeof TEMPLATE_IDS)[number], string> = {
    MINIMAL: dict.templateMinimalDescription,
    BOLD_HEADLINE: dict.templateBoldHeadlineDescription,
    PROMOTIONAL_BANNER: dict.templatePromotionalBannerDescription,
    SPLIT_PRODUCT: dict.templateSplitProductDescription,
    MODERN_BANNER: dict.templateModernBannerDescription,
    BADGE_OFFER: dict.templateBadgeOfferDescription,
    MINIMALIST_FRAME: dict.templateMinimalistFrameDescription,
  };

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
          defaultValue={defaultHeadline?.slice(0, 70)}
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

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">{dict.template}</label>
        <div className="grid grid-cols-2 gap-2">
          {orderedTemplateIds.map((id, index) => (
            <label
              key={id}
              className="flex cursor-pointer flex-col gap-0.5 rounded-md border border-paper-border dark:border-night-border bg-paper dark:bg-night-card px-3 py-2 text-sm has-[:checked]:border-ink has-[:checked]:dark:border-ink-dark"
            >
              <span className="flex items-center gap-2 font-medium">
                <input type="radio" name="template" value={id} defaultChecked={index === 0} className="accent-current" />
                {templateNames[id]}
              </span>
              <span className="text-xs text-ink-soft dark:text-ink-soft-dark">{templateDescriptions[id]}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="backgroundSource" className="text-sm font-medium">
          {dict.background}
        </label>
        <select
          id="backgroundSource"
          name="backgroundSource"
          defaultValue={defaultBackgroundSource}
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

      {state?.status === "error" && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
      {state?.status === "success" && state.warnings.length > 0 && (
        <ul role="status" className="flex flex-col gap-1 text-sm text-amber-600 dark:text-amber-400">
          {state.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}
      {state?.status === "success" && (
        <p role="status" className="text-sm text-green-700 dark:text-green-400">
          {dict.generatedSuccess}
        </p>
      )}
      {/* Real disclosure, not cosmetic — see generate-caption-form.tsx's
          identical block for the full reasoning. Only ever set for the
          AI background path when a runtime-failure fallback actually
          happened. */}
      {state?.status === "success" && state.fallbackFrom && state.fallbackFrom.length > 0 && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          {common.fallbackNotice(state.backgroundProviderName ?? dict.backgroundAI, state.fallbackFrom[0].fromProvider)}
        </p>
      )}

      <Button type="submit" pending={pending} pendingLabel={dict.generating}>
        <NavIcons.poster size={18} aria-hidden="true" />
        {dict.generate}
      </Button>
    </form>
  );
}

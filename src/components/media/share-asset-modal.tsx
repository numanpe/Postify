"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { shareGeneratedAsset } from "@/lib/actions/media-share";
import { BottomSheet, type BottomSheetHandle } from "@/components/ui/bottom-sheet";
import { useDict } from "@/components/i18n/locale-provider";
import { ActionIcons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { InstagramAudioPicker } from "@/components/media/instagram-audio-picker";

export interface ShareTargetOption {
  key: string;
  displayName: string;
  acceptsImages: boolean;
  acceptsVideo: boolean;
}

interface ShareAssetModalProps {
  assetKind: "poster" | "video";
  assetId: string;
  defaultCaption: string;
  targets: ShareTargetOption[];
  connectAccountsHref: string;
  // Part 3: true only when this company both has an Instagram target
  // available AND publishes through Zernio specifically — the one real,
  // verified provider this capability exists for (see
  // zernio-audio.ts's own doc comment). A company on a different
  // aggregator with a real Instagram target still gets no picker; that
  // provider genuinely has no equivalent API.
  instagramAudioAvailable?: boolean;
  // Real bug found live (2026-09-03): a company can have a genuinely
  // saved, selected aggregator credential (real API key) whose
  // accountMap is empty or failed to parse — most commonly "Platform
  // account IDs" left blank or typed without the required
  // PLATFORM:accountId format in Settings, which saveAggregatorCredential's
  // own parseAccountMap silently drops with no validation feedback (see
  // that file's own fix for the save-time half of this). That company
  // has a real connection but zero usable targets — used to render
  // identically to "nothing connected at all," pointing the user at
  // /publish, which doesn't even list aggregator connections.
  aggregatorMisconfigured?: boolean;
}

// Media Library's "Share" button (2026-09-02) — a real entry point into
// the app's two existing publish systems (createPublishJob for Direct
// Meta accounts, publishStandaloneAssetViaAggregatorForCompany for a
// Zernio/aggregator-connected one), see media-share.ts's own doc
// comment. BottomSheet is the same shared, mobile-first dialog
// VideoEditModal already uses — real tap targets, swipe-to-dismiss,
// RTL-safe by construction.
export function ShareAssetModal({
  assetKind,
  assetId,
  defaultCaption,
  targets,
  connectAccountsHref,
  instagramAudioAvailable,
  aggregatorMisconfigured,
}: ShareAssetModalProps) {
  const dict = useDict().media;
  const router = useRouter();
  const sheetRef = useRef<BottomSheetHandle>(null);
  const [state, action, pending] = useActionState(shareGeneratedAsset, undefined);

  const eligibleTargets = targets.filter((t) => (assetKind === "video" ? t.acceptsVideo : t.acceptsImages));
  const [targetKey, setTargetKey] = useState(eligibleTargets[0]?.key ?? "");

  const success = state && "success" in state;
  useEffect(() => {
    if (success) {
      router.refresh();
      const timer = setTimeout(() => sheetRef.current?.close(), 1200);
      return () => clearTimeout(timer);
    }
  }, [success, router]);

  return (
    <>
      <button
        type="button"
        onClick={() => sheetRef.current?.showModal()}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded border border-paper-border dark:border-night-border px-1.5 py-0.5"
      >
        <ActionIcons.share size={14} aria-hidden="true" />
        {dict.shareButton}
      </button>
      <BottomSheet ref={sheetRef} title={dict.shareTitle} closeLabel={dict.shareCancel}>
        {eligibleTargets.length === 0 ? (
          <div className="flex flex-col gap-2 pb-4 text-sm">
            {/* Real bug fixed here (found live via a Direct-Facebook-only
                company sharing a video): targets.length > 0 but
                eligibleTargets.length === 0 means the company HAS real
                connected accounts, none of which support this asset's
                kind (Direct Meta never supports video — see
                platform-status.ts's VIDEO_ONLY_PLATFORMS). The old copy
                said "No connected accounts yet" regardless, which reads
                as "you haven't connected anything" when that's false —
                and its only link pointed to /publish (the Direct-connect
                page), not Settings' aggregator options, which is what
                would actually unlock this. Never a redirect either way —
                just a link inside this same modal. */}
            {/* A second, more specific empty case found live
                (2026-09-03): a company can have a genuinely saved,
                selected Zernio credential with zero usable targets
                because its account-ID mapping is empty/unparseable —
                real connection, still "no accounts" from targets.length's
                point of view, but "connect an account" is false (one IS
                connected) and /publish is the wrong destination (it
                never lists aggregator connections at all). Checked
                first since it's the most specific real cause. */}
            <p className="text-ink-soft dark:text-ink-soft-dark">
              {targets.length > 0
                ? assetKind === "video"
                  ? dict.shareNoEligibleAccountsVideo
                  : dict.shareNoEligibleAccountsPoster
                : aggregatorMisconfigured
                  ? dict.shareAggregatorMisconfigured
                  : dict.shareNoAccounts}
            </p>
            <a
              href={targets.length > 0 || aggregatorMisconfigured ? "/settings" : connectAccountsHref}
              className="underline underline-offset-2"
            >
              {targets.length > 0
                ? dict.shareNoEligibleAccountsHint
                : aggregatorMisconfigured
                  ? dict.shareAggregatorMisconfiguredHint
                  : dict.shareNoAccountsHint}
            </a>
          </div>
        ) : (
          <form action={action} className="flex flex-col gap-4 pb-4">
            <input type="hidden" name={assetKind === "poster" ? "posterId" : "videoId"} value={assetId} />

            <div className="flex flex-col gap-1">
              <label htmlFor="targetKey" className="text-sm font-medium">
                {dict.shareTo}
              </label>
              <select
                id="targetKey"
                name="targetKey"
                required
                value={targetKey}
                onChange={(e) => setTargetKey(e.target.value)}
                className="min-h-[48px] rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-3 py-2 text-base"
              >
                {eligibleTargets.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.displayName}
                  </option>
                ))}
              </select>
            </div>

            {assetKind === "video" && instagramAudioAvailable && <InstagramAudioPicker />}

            <div className="flex flex-col gap-1">
              <label htmlFor="caption" className="text-sm font-medium">
                {dict.shareCaption}
              </label>
              <textarea
                id="caption"
                name="caption"
                required
                rows={4}
                maxLength={2200}
                defaultValue={defaultCaption}
                className="rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-3 py-2 text-base"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="scheduledFor" className="text-sm font-medium">
                {dict.shareWhen} <span className="font-normal text-ink-soft dark:text-ink-soft-dark">{dict.shareWhenHint}</span>
              </label>
              <input
                id="scheduledFor"
                name="scheduledFor"
                type="datetime-local"
                className="min-h-[48px] rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-3 py-2 text-base"
              />
            </div>

            {state && "error" in state && (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                {state.error}
              </p>
            )}
            {success && (
              <p role="status" className="text-sm text-green-700 dark:text-green-400">
                {state.message}
              </p>
            )}

            <Button type="submit" pending={pending} pendingLabel={dict.sharePublishing}>
              {dict.sharePublishNow}
            </Button>
          </form>
        )}
      </BottomSheet>
    </>
  );
}

"use client";

import { useActionState, useRef, useState } from "react";

import { editCampaignItemVideo } from "@/lib/actions/video-edit";
import { Button } from "@/components/ui/button";
import { BottomSheet, type BottomSheetHandle } from "@/components/ui/bottom-sheet";
import { useDict } from "@/components/i18n/locale-provider";
import { ActionIcons } from "@/components/icons";

// Duration comes from the <video> element's own onLoadedMetadata (real
// playback metadata) rather than a stored DB field, so no schema
// change was needed just to power the trim sliders.
export function VideoEditModal({ itemId, videoUrl }: { itemId: string; videoUrl: string }) {
  const dict = useDict().video;
  const sheetRef = useRef<BottomSheetHandle>(null);
  const [duration, setDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [state, action, pending] = useActionState(editCampaignItemVideo.bind(null, itemId), undefined);

  return (
    <>
      <button
        type="button"
        onClick={() => sheetRef.current?.showModal()}
        className="inline-flex min-h-[48px] w-full items-center justify-center gap-1.5 rounded border border-paper-border dark:border-night-border px-1.5 py-0.5"
      >
        <ActionIcons.editVideo size={14} aria-hidden="true" />
        {dict.editVideo}
      </button>
      <BottomSheet ref={sheetRef} title={dict.editVideo} closeLabel={dict.editVideoCancel}>
        <div className="flex flex-col gap-3 pb-3">
          <video
            src={videoUrl}
            controls
            className="w-full rounded bg-black"
            onLoadedMetadata={(e) => {
              const d = e.currentTarget.duration;
              setDuration(d);
              setTrimStart(0);
              setTrimEnd(d);
            }}
          />

          <form action={action} className="flex flex-col gap-3">
            <input type="hidden" name="trimStart" value={trimStart} />
            <input type="hidden" name="trimEnd" value={trimEnd} />

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium">
                {dict.editVideoTrimStart}: {trimStart.toFixed(1)}s
              </label>
              <input
                type="range"
                min={0}
                max={duration || 1}
                step={0.1}
                value={trimStart}
                disabled={duration === 0}
                onChange={(e) => setTrimStart(Math.min(Number(e.target.value), trimEnd - 0.5))}
                className="min-h-[48px] accent-current"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium">
                {dict.editVideoTrimEnd}: {trimEnd.toFixed(1)}s
              </label>
              <input
                type="range"
                min={0}
                max={duration || 1}
                step={0.1}
                value={trimEnd}
                disabled={duration === 0}
                onChange={(e) => setTrimEnd(Math.max(Number(e.target.value), trimStart + 0.5))}
                className="min-h-[48px] accent-current"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor={`overlay-${itemId}`} className="text-xs font-medium">
                {dict.editVideoOverlayText}
              </label>
              <input
                id={`overlay-${itemId}`}
                name="overlayText"
                type="text"
                maxLength={80}
                placeholder={dict.editVideoOverlayPlaceholder}
                className="rounded border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-2 py-1 text-base"
              />
            </div>

            {state && "error" in state && <p className="text-red-600 dark:text-red-400">{state.error}</p>}
            {state && "success" in state && (
              <p className="text-green-700 dark:text-green-400">{dict.editVideoSaved}</p>
            )}

            <Button type="submit" size="sm" pending={pending} pendingLabel={dict.editVideoSaving}>
              {dict.editVideoSave}
            </Button>
          </form>
        </div>
      </BottomSheet>
    </>
  );
}

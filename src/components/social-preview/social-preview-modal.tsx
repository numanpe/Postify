"use client";

import { useRef } from "react";

import { SocialMediaPreviewer, type SocialMediaPreviewerProps } from "./social-media-previewer";
import { useDict } from "@/components/i18n/locale-provider";
import { SocialPreviewIcons } from "@/components/icons";

// Same native <dialog> pattern as video-edit-modal.tsx — no generalized
// modal primitive exists yet, and duplicating this one small pattern
// twice doesn't justify building one.
export function SocialPreviewModal(props: SocialMediaPreviewerProps) {
  const dict = useDict().socialPreview;
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded border border-paper-border dark:border-night-border px-1.5 py-0.5"
      >
        <SocialPreviewIcons.views size={14} aria-hidden="true" />
        {dict.trigger}
      </button>
      <dialog
        ref={dialogRef}
        className="w-[92vw] max-w-lg rounded-md border border-paper-border dark:border-night-border bg-paper dark:bg-night-card p-4 text-sm text-ink dark:text-ink-dark backdrop:bg-black/60"
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">{dict.title}</h2>
            <button type="button" onClick={() => dialogRef.current?.close()} className="text-xs underline">
              {dict.close}
            </button>
          </div>
          <SocialMediaPreviewer {...props} />
        </div>
      </dialog>
    </>
  );
}

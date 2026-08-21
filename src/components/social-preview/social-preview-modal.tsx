"use client";

import { useRef } from "react";
import dynamic from "next/dynamic";

import type { SocialMediaPreviewerProps } from "./social-media-previewer";
import { BottomSheet, type BottomSheetHandle } from "@/components/ui/bottom-sheet";
import { useDict } from "@/components/i18n/locale-provider";
import { SocialPreviewIcons } from "@/components/icons";

// Only loaded once the sheet actually opens — every poster/video list
// item and every campaign card gets its own trigger button, but the
// tab-switching preview UI itself is only needed for the one a user
// actually clicks into.
const SocialMediaPreviewer = dynamic(
  () => import("./social-media-previewer").then((m) => m.SocialMediaPreviewer),
  { ssr: false, loading: () => <PreviewerSkeleton /> },
);

function PreviewerSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-3">
      <div className="flex gap-4 border-b border-paper-border pb-2 dark:border-night-border">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-4 w-16 rounded bg-paper-card dark:bg-night" />
        ))}
      </div>
      <div className="mx-auto h-[420px] w-[240px] rounded-xl bg-paper-card dark:bg-night" />
    </div>
  );
}

export function SocialPreviewModal(props: SocialMediaPreviewerProps) {
  const dict = useDict().socialPreview;
  const sheetRef = useRef<BottomSheetHandle>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => sheetRef.current?.showModal()}
        className="inline-flex min-h-[48px] w-full items-center justify-center gap-1.5 rounded border border-paper-border dark:border-night-border px-1.5 py-0.5"
      >
        <SocialPreviewIcons.views size={14} aria-hidden="true" />
        {dict.trigger}
      </button>
      <BottomSheet ref={sheetRef} title={dict.title} closeLabel={dict.close}>
        <div className="pb-3">
          <SocialMediaPreviewer {...props} />
        </div>
      </BottomSheet>
    </>
  );
}

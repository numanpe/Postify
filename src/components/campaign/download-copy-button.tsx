"use client";

import { useState } from "react";

import { useDict } from "@/components/i18n/locale-provider";

// Task 2, Option 1: "Download Asset & Copy Caption". One real click does
// both — copies caption+hashtags to the clipboard, then triggers the
// actual file download via the real /api/campaign-items/[id]/download
// route (Content-Disposition: attachment). Deliberately client-only and
// deliberately never touches publish/cleanup state — see that route's
// doc comment for why downloading never counts as publish confirmation.
export function DownloadCopyButton({
  itemId,
  captionText,
  hashtags,
}: {
  itemId: string;
  captionText: string | null;
  hashtags: string[];
}) {
  const dict = useDict().publishing;
  const [showToast, setShowToast] = useState(false);

  async function handleClick() {
    const text = [captionText, hashtags.join(" ")].filter(Boolean).join("\n\n");
    if (text) {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        // Clipboard access can be denied by the browser — the download
        // itself still proceeds, it just won't have copied the caption.
      }
    }

    const link = document.createElement("a");
    link.href = `/api/campaign-items/${itemId}/download`;
    link.click();

    setShowToast(true);
    setTimeout(() => setShowToast(false), 2500);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleClick}
        className="w-full rounded bg-primary px-1.5 py-0.5 text-paper dark:bg-primary-dark dark:text-night"
      >
        {dict.downloadButton}
      </button>
      {showToast && (
        <span className="absolute inset-x-0 top-full z-10 mt-1 rounded bg-ink px-1.5 py-0.5 text-center text-paper dark:bg-ink-dark dark:text-night">
          {dict.downloadedToast}
        </span>
      )}
    </div>
  );
}

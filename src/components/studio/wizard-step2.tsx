"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { PosterForm } from "@/components/poster/poster-form";
import { VideoForm } from "@/components/video/video-form";
import type { TopicSuggestion } from "@/components/ui/topic-suggestions";
import { useDict } from "@/components/i18n/locale-provider";

interface PhotoAsset {
  id: string;
  fileName: string;
}
interface VideoAsset {
  id: string;
  fileName: string;
  mimeType: string;
}

export function WizardStep2({
  defaultHeadline,
  defaultTopic,
  photoAssets,
  videoAssets,
  defaultBackgroundSource,
  narrationAvailable,
  preferredTemplateOrder,
  topicSuggestions,
}: {
  defaultHeadline: string;
  defaultTopic: string;
  photoAssets: PhotoAsset[];
  videoAssets: VideoAsset[];
  defaultBackgroundSource: "BRAND" | "PHOTO";
  narrationAvailable: boolean;
  // Computed server-side (studio/design/page.tsx) — see PosterForm's
  // own doc comment on this prop.
  preferredTemplateOrder?: readonly string[];
  topicSuggestions: TopicSuggestion[];
}) {
  const [mode, setMode] = useState<"poster" | "video">("poster");
  const dict = useDict().wizard;
  const router = useRouter();

  return (
    <div className="flex w-full max-w-md flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{dict.step2Title}</h1>
        <Link href="/studio" className="w-fit text-xs text-ink-soft underline dark:text-ink-soft-dark">
          {dict.backToEdit}
        </Link>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode("poster")}
          className={`min-h-[48px] flex-1 rounded-md border px-3 py-2 text-sm font-medium ${
            mode === "poster"
              ? "border-primary bg-primary text-paper dark:border-primary-dark dark:bg-primary-dark dark:text-night"
              : "border-paper-border text-ink dark:border-night-border dark:text-ink-dark"
          }`}
        >
          {dict.toggleStaticPoster}
        </button>
        <button
          type="button"
          onClick={() => setMode("video")}
          className={`min-h-[48px] flex-1 rounded-md border px-3 py-2 text-sm font-medium ${
            mode === "video"
              ? "border-primary bg-primary text-paper dark:border-primary-dark dark:bg-primary-dark dark:text-night"
              : "border-paper-border text-ink dark:border-night-border dark:text-ink-dark"
          }`}
        >
          {dict.toggleMotionVideo}
        </button>
      </div>

      {mode === "poster" ? (
        <PosterForm
          photoAssets={photoAssets}
          defaultBackgroundSource={defaultBackgroundSource}
          defaultHeadline={defaultHeadline}
          preferredTemplateOrder={preferredTemplateOrder}
          onSuccess={(posterId) => router.push(`/studio/publish?assetType=poster&id=${posterId}`)}
        />
      ) : (
        <VideoForm
          assets={videoAssets}
          narrationAvailable={narrationAvailable}
          defaultTopic={defaultTopic}
          topicSuggestions={topicSuggestions}
          onSuccess={(videoId) => router.push(`/studio/publish?assetType=video&id=${videoId}`)}
        />
      )}
    </div>
  );
}

"use client";

import { useActionState, useState } from "react";
import Link from "next/link";

import { repurposeContent } from "@/lib/actions/repurpose";
import { Button } from "@/components/ui/button";
import { useDict } from "@/components/i18n/locale-provider";

interface PosterOption {
  id: string;
  headline: string;
}
interface VideoOption {
  id: string;
  topic: string;
}

function CopyCaptionButton({ text }: { text: string }) {
  const dict = useDict().repurpose;
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // Clipboard access can be denied by the browser — no crash,
          // the text is still visible to copy manually.
        }
      }}
      className="text-xs font-medium underline shrink-0"
    >
      {copied ? dict.copiedToast : dict.copyButton}
    </button>
  );
}

export function RepurposeForm({ posters, videos }: { posters: PosterOption[]; videos: VideoOption[] }) {
  const dict = useDict().repurpose;
  const [source, setSource] = useState<"POSTER" | "VIDEO" | "TEXT">(posters.length > 0 ? "POSTER" : "TEXT");
  const [state, action, pending] = useActionState(repurposeContent, undefined);

  return (
    <div className="flex flex-col gap-6">
      <form action={action} className="flex w-full max-w-md flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="sourceType"
              value="POSTER"
              checked={source === "POSTER"}
              onChange={() => setSource("POSTER")}
              disabled={posters.length === 0}
              className="accent-current"
            />
            {dict.sourcePoster}
          </label>
          {source === "POSTER" && (
            <select
              name="sourceId"
              required
              className="rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-3 py-2 text-base"
            >
              <option value="" disabled>
                {dict.choosePoster}
              </option>
              {posters.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.headline}
                </option>
              ))}
            </select>
          )}

          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="sourceType"
              value="VIDEO"
              checked={source === "VIDEO"}
              onChange={() => setSource("VIDEO")}
              disabled={videos.length === 0}
              className="accent-current"
            />
            {dict.sourceVideo}
          </label>
          {source === "VIDEO" && (
            <select
              name="sourceId"
              required
              className="rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-3 py-2 text-base"
            >
              <option value="" disabled>
                {dict.chooseVideo}
              </option>
              {videos.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.topic}
                </option>
              ))}
            </select>
          )}

          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="sourceType"
              value="TEXT"
              checked={source === "TEXT"}
              onChange={() => setSource("TEXT")}
              className="accent-current"
            />
            {dict.sourceText}
          </label>
          {source === "TEXT" && (
            <textarea
              name="manualText"
              rows={2}
              placeholder={dict.describePlaceholder}
              className="rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-3 py-2 text-base"
            />
          )}
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">{dict.formatsLabel}</span>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="formats" value="POSTER" defaultChecked className="accent-current" />
            {dict.formatPoster}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="formats" value="VIDEO" className="accent-current" />
            {dict.formatVideo}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="formats" value="CAPTIONS" defaultChecked className="accent-current" />
            {dict.formatCaptions}
          </label>
        </div>

        {state?.status === "error" && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}

        <Button type="submit" pending={pending} pendingLabel={dict.generating}>
          {dict.generate}
        </Button>
      </form>

      {state?.status === "success" && (
        <div className="flex flex-col gap-2 rounded-md border border-paper-border dark:border-night-border p-3">
          <h2 className="text-sm font-semibold">{dict.resultTitle}</h2>
          {state.posterId && (
            <p className="text-sm">
              <Link href="/studio/poster" className="underline">
                {dict.resultPoster}
              </Link>
            </p>
          )}
          {state.videoId && (
            <p className="text-sm">
              <Link href="/studio/video" className="underline">
                {dict.resultVideo}
              </Link>
            </p>
          )}
          {state.captions && state.captions.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">{dict.resultCaptions}</p>
              <ul className="flex flex-col gap-1">
                {state.captions.map((caption, i) => (
                  <li
                    key={i}
                    className="flex items-start justify-between gap-2 rounded border border-paper-border dark:border-night-border p-2 text-sm"
                  >
                    <span className="whitespace-pre-wrap">{caption}</span>
                    <CopyCaptionButton text={caption} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

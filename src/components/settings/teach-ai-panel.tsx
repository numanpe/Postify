"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";

import { markContentSignal, submitTeachExample, type TeachDirection } from "@/lib/actions/teach-ai";
import { Button } from "@/components/ui/button";

export interface TeachableItem {
  id: string;
  kind: "poster" | "video";
  thumbnailUrl: string | null; // null for video — this app has no video-thumbnail generation anywhere yet (confirmed: even the real Media Library grid shows video assets as a plain mimeType label, not a preview frame — see media/page.tsx). Not faked here either.
  label: string;
}

interface TeachAiLabels {
  teachTitle: string;
  teachSubtitle: string;
  teachNoContent: string;
  teachMoreLikeThis: string;
  teachNeverLikeThis: string;
  teachMarked: string;
  teachExampleTitle: string;
  teachExampleSubtitle: string;
  teachExampleFileLabel: string;
  teachExampleTopicPlaceholder: string;
  teachExampleStylePlaceholder: string;
  teachExampleSubmit: string;
  teachExampleSubmitting: string;
  teachExampleDone: string;
}

// Part 2's real UI: mark existing generated content, or upload an
// external example, as an explicit like/dislike signal feeding the
// exact same weighting system (see actions/teach-ai.ts's doc comment —
// this is a new INPUT, not a new learning system). MIN_SAMPLE_SIZE
// (signals.ts, reused unchanged by aggregate.ts) is the real
// safeguard against a single upload overcorrecting anything — nothing
// here needs its own throttle.
export function TeachAiPanel({ items, labels }: { items: TeachableItem[]; labels: TeachAiLabels }) {
  const dict = labels;
  const [marked, setMarked] = useState<Record<string, TeachDirection>>({});
  const [pending, startTransition] = useTransition();
  const [exampleState, exampleAction, examplePending] = useActionState(submitTeachExample, undefined);
  const [exampleDone, setExampleDone] = useState(false);
  const wasExamplePending = useRef(false);
  useEffect(() => {
    if (wasExamplePending.current && !examplePending && !exampleState?.error) {
      setExampleDone(true);
    }
    wasExamplePending.current = examplePending;
  }, [examplePending, exampleState]);

  function mark(item: TeachableItem, direction: TeachDirection) {
    setMarked((prev) => ({ ...prev, [item.id]: direction }));
    startTransition(async () => {
      await markContentSignal({
        posterId: item.kind === "poster" ? item.id : undefined,
        videoId: item.kind === "video" ? item.id : undefined,
        direction,
      });
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">{dict.teachTitle}</h2>
      <p className="text-xs text-ink-soft dark:text-ink-soft-dark">{dict.teachSubtitle}</p>

      {items.length === 0 ? (
        <p className="text-sm text-ink-soft dark:text-ink-soft-dark">{dict.teachNoContent}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {items.map((item) => {
            const direction = marked[item.id];
            return (
              <li
                key={`${item.kind}:${item.id}`}
                className="flex flex-col gap-1 rounded-md border border-paper-border p-1.5 text-xs dark:border-night-border"
              >
                <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded bg-paper-border/40 dark:bg-night-border/40">
                  {item.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-[10px] text-ink-soft dark:text-ink-soft-dark">video</span>
                  )}
                </div>
                <p className="truncate" title={item.label}>
                  {item.label}
                </p>
                <div className="flex gap-1">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => mark(item, "LIKE")}
                    aria-pressed={direction === "LIKE"}
                    className={`flex-1 rounded border px-1 py-0.5 disabled:opacity-60 ${
                      direction === "LIKE"
                        ? "border-green-600 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                        : "border-paper-border dark:border-night-border"
                    }`}
                  >
                    {dict.teachMoreLikeThis}
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => mark(item, "DISLIKE")}
                    aria-pressed={direction === "DISLIKE"}
                    className={`flex-1 rounded border px-1 py-0.5 disabled:opacity-60 ${
                      direction === "DISLIKE"
                        ? "border-red-600 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                        : "border-paper-border dark:border-night-border"
                    }`}
                  >
                    {dict.teachNeverLikeThis}
                  </button>
                </div>
                {direction && <p className="text-[10px] text-ink-soft dark:text-ink-soft-dark">{dict.teachMarked}</p>}
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-2 flex flex-col gap-2 rounded-md border border-paper-border p-3 dark:border-night-border">
        <h3 className="text-sm font-medium">{dict.teachExampleTitle}</h3>
        <p className="text-xs text-ink-soft dark:text-ink-soft-dark">{dict.teachExampleSubtitle}</p>
        <form
          action={(formData) => {
            setExampleDone(false);
            exampleAction(formData);
          }}
          className="flex flex-col gap-2"
        >
          <input
            type="file"
            name="file"
            accept="image/*,video/*"
            required
            aria-label={dict.teachExampleFileLabel}
            className="text-sm"
          />
          <input
            type="text"
            name="topic"
            placeholder={dict.teachExampleTopicPlaceholder}
            className="rounded border border-paper-border bg-transparent px-2 py-1 text-sm dark:border-night-border"
          />
          <input
            type="text"
            name="visualStyle"
            placeholder={dict.teachExampleStylePlaceholder}
            className="rounded border border-paper-border bg-transparent px-2 py-1 text-sm dark:border-night-border"
          />
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1 text-sm">
              <input type="radio" name="direction" value="LIKE" defaultChecked /> {dict.teachMoreLikeThis}
            </label>
            <label className="flex items-center gap-1 text-sm">
              <input type="radio" name="direction" value="DISLIKE" /> {dict.teachNeverLikeThis}
            </label>
          </div>
          <Button type="submit" pending={examplePending} pendingLabel={dict.teachExampleSubmitting} size="sm" className="w-fit">
            {dict.teachExampleSubmit}
          </Button>
          {exampleState?.error ? (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {exampleState.error}
            </p>
          ) : (
            exampleDone && !examplePending && <p className="text-sm text-green-700 dark:text-green-400">{dict.teachExampleDone}</p>
          )}
        </form>
      </div>
    </div>
  );
}

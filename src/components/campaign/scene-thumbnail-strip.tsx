"use client";

import { useRef, useState } from "react";

import { useDict } from "@/components/i18n/locale-provider";

export interface ThumbnailSceneItem {
  key: string;
  thumbnailUrl: string | null;
  overlayText: string;
  // null hides the duration control entirely — narrated scenes derive
  // their real length from narration timing (see scene-editor.ts) and
  // have no independent duration to edit.
  durationSec: number | null;
  // Narrated scenes only — the real script section this scene maps to
  // (Hook/Context/Value/Message/CTA), shown as a real, tappable
  // connection back to the script editor rather than a disabled control.
  scriptLabel: string | null;
}

interface SceneThumbnailStripProps {
  items: ThumbnailSceneItem[];
  // Non-narrated: full editor (remove/add/reorder/duration). Narrated:
  // read-only strip except the swap-media action, which is safe for
  // both (see this feature's own scope notes).
  editable: boolean;
  onThumbnailClick: (index: number) => void;
  onRemove?: (index: number) => void;
  onAdd?: () => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
  onDurationChange?: (index: number, durationSec: number) => void;
  onJumpToScript?: (index: number) => void;
  minDurationSec?: number;
  maxDurationSec?: number;
  maxItems?: number;
}

// A visual, horizontal representation of the scene list that already
// exists — not a timeline editor. No frame-accurate scrubbing, no
// multi-track, no in-clip trimming; just real thumbnails standing in
// for the text-row list this replaces, with the same underlying
// actions (reorder/remove/add/duration/swap) this file's callers
// already owned before this component existed.
//
// Reordering is real pointer-based drag (works for mouse AND touch,
// unlike the native HTML5 drag-and-drop API, which iOS/Android browsers
// don't support well) — plus explicit ▲/▼ buttons as an always-present
// keyboard/screen-reader-accessible fallback, since a pointer drag alone
// isn't operable without a pointer.
export function SceneThumbnailStrip({
  items,
  editable,
  onThumbnailClick,
  onRemove,
  onAdd,
  onReorder,
  onDurationChange,
  onJumpToScript,
  minDurationSec = 1.5,
  maxDurationSec = 10,
  maxItems,
}: SceneThumbnailStripProps) {
  const dict = useDict().video;
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const cardRefs = useRef<(HTMLLIElement | null)[]>([]);

  function handleDragPointerDown(index: number, e: React.PointerEvent<HTMLButtonElement>) {
    if (!editable || !onReorder) return;
    setDragIndex(index);
    setOverIndex(index);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handleDragPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (dragIndex === null) return;
    let nearest: number | null = null;
    let nearestDist = Infinity;
    cardRefs.current.forEach((el, i) => {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const center = rect.left + rect.width / 2;
      const dist = Math.abs(e.clientX - center);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = i;
      }
    });
    if (nearest !== null) setOverIndex(nearest);
  }

  function handleDragPointerUp() {
    if (dragIndex !== null && overIndex !== null && overIndex !== dragIndex) {
      onReorder?.(dragIndex, overIndex);
    }
    setDragIndex(null);
    setOverIndex(null);
  }

  return (
    <ul className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
      {items.map((item, i) => (
        <li
          key={item.key}
          ref={(el) => {
            cardRefs.current[i] = el;
          }}
          className={`relative flex w-36 shrink-0 flex-col gap-1.5 rounded-lg border p-1.5 ${
            dragIndex === i
              ? "opacity-50"
              : overIndex === i && dragIndex !== null
                ? "border-primary dark:border-primary-dark"
                : "border-paper-border dark:border-night-border"
          }`}
        >
          <button
            type="button"
            onClick={() => onThumbnailClick(i)}
            className="relative block aspect-square w-full overflow-hidden rounded-md bg-paper-card dark:bg-night-card"
          >
            {item.thumbnailUrl ? (
              // Real per-scene thumbnails (a real uploaded photo, a real
              // extracted video frame, or the real generated AI image —
              // see scene-thumbnails.ts) — not a placeholder graphic.
              // eslint-disable-next-line @next/next/no-img-element -- a real per-scene thumbnail from arbitrary storage, not a static asset next/image can optimize
              <img
                src={item.thumbnailUrl}
                alt={dict.sceneThumbnailAlt(i + 1)}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex h-full items-center justify-center px-2 text-center text-[11px] text-ink-soft dark:text-ink-soft-dark">
                {dict.sceneNoPreview}
              </span>
            )}
          </button>

          {editable && onRemove && (
            <button
              type="button"
              onClick={() => onRemove(i)}
              disabled={items.length === 1}
              aria-label={dict.sceneRemoveAria(i + 1)}
              className="absolute end-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-night/70 text-base leading-none text-paper disabled:cursor-not-allowed disabled:opacity-40"
            >
              ×
            </button>
          )}

          {item.overlayText && (
            <p className="truncate text-[11px] text-ink-soft dark:text-ink-soft-dark" title={item.overlayText}>
              {item.overlayText}
            </p>
          )}

          {item.durationSec !== null && onDurationChange && (
            <div className="flex items-center gap-1.5">
              <input
                type="range"
                min={minDurationSec}
                max={maxDurationSec}
                step={0.5}
                value={item.durationSec}
                onChange={(e) => onDurationChange(i, Number(e.target.value))}
                aria-label={dict.sceneDurationLabel}
                className="min-h-[36px] flex-1 accent-current"
              />
              <span className="w-8 shrink-0 text-end text-[11px] tabular-nums text-ink-soft dark:text-ink-soft-dark">
                {item.durationSec.toFixed(1)}s
              </span>
            </div>
          )}

          {item.scriptLabel && onJumpToScript && (
            <button
              type="button"
              onClick={() => onJumpToScript(i)}
              aria-label={dict.sceneJumpToScriptAria(item.scriptLabel)}
              className="min-h-[36px] rounded border border-paper-border px-1.5 text-[11px] font-medium text-ink-soft underline dark:border-night-border dark:text-ink-soft-dark"
            >
              {item.scriptLabel} · {dict.sceneJumpToScript}
            </button>
          )}

          {editable && onReorder && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onPointerDown={(e) => handleDragPointerDown(i, e)}
                onPointerMove={handleDragPointerMove}
                onPointerUp={handleDragPointerUp}
                onPointerCancel={handleDragPointerUp}
                aria-label={dict.sceneDragHandleAria(i + 1)}
                className="flex min-h-[36px] flex-1 touch-none items-center justify-center rounded border border-paper-border text-sm text-ink-soft active:cursor-grabbing dark:border-night-border dark:text-ink-soft-dark"
              >
                ⠿
              </button>
              <button
                type="button"
                disabled={i === 0}
                onClick={() => onReorder(i, i - 1)}
                aria-label={dict.sceneMoveUp}
                className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded border border-paper-border disabled:cursor-not-allowed disabled:opacity-30 dark:border-night-border"
              >
                ▲
              </button>
              <button
                type="button"
                disabled={i === items.length - 1}
                onClick={() => onReorder(i, i + 1)}
                aria-label={dict.sceneMoveDown}
                className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded border border-paper-border disabled:cursor-not-allowed disabled:opacity-30 dark:border-night-border"
              >
                ▼
              </button>
            </div>
          )}
        </li>
      ))}

      {editable && onAdd && (
        <li className="flex w-36 shrink-0">
          <button
            type="button"
            onClick={onAdd}
            disabled={maxItems !== undefined && items.length >= maxItems}
            aria-label={dict.sceneAddAria}
            className="flex min-h-[44px] w-full flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-paper-border text-2xl text-ink-soft disabled:cursor-not-allowed disabled:opacity-40 dark:border-night-border dark:text-ink-soft-dark"
          >
            +
          </button>
        </li>
      )}
    </ul>
  );
}

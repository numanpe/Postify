"use client";

import { forwardRef, useImperativeHandle, useRef, useState, type ReactNode } from "react";

export interface BottomSheetHandle {
  showModal: () => void;
  close: () => void;
}

interface BottomSheetProps {
  title: string;
  closeLabel: string;
  children: ReactNode;
}

const DISMISS_THRESHOLD_PX = 90;

// Native <dialog> underneath (same accessible, well-supported element
// the app already used for its two modals) — the only thing that
// changes below md: (768px) is CSS: fixed to the bottom edge, rounded
// top corners, capped at 85vh, instead of the centered card shown at
// md: and above. One shared primitive so VideoEditModal and
// SocialPreviewModal (and anything else that needs a dialog later)
// don't each reimplement this responsive behavior and the swipe-to-
// dismiss gesture separately.
//
// The drag handle only tracks vertical movement (dismiss = drag down),
// which is inherently direction-agnostic — RTL affects horizontal
// layout, not a vertical swipe-down gesture, so there's no LTR/RTL
// branching needed here despite the sheet living in a fully RTL-aware
// app.
export const BottomSheet = forwardRef<BottomSheetHandle, BottomSheetProps>(function BottomSheet(
  { title, closeLabel, children },
  ref,
) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ startY: number; dragging: boolean } | null>(null);
  const [dragOffset, setDragOffset] = useState(0);

  useImperativeHandle(ref, () => ({
    showModal: () => dialogRef.current?.showModal(),
    close: () => dialogRef.current?.close(),
  }));

  function onPointerDown(e: React.PointerEvent) {
    dragState.current = { startY: e.clientY, dragging: true };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragState.current?.dragging) return;
    const delta = e.clientY - dragState.current.startY;
    setDragOffset(Math.max(0, delta)); // only downward drag moves the sheet
  }

  function onPointerUp() {
    if (!dragState.current) return;
    dragState.current.dragging = false;
    if (dragOffset > DISMISS_THRESHOLD_PX) {
      dialogRef.current?.close();
    }
    setDragOffset(0);
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={() => setDragOffset(0)}
      aria-label={title}
      className="m-0 w-full max-w-none rounded-t-2xl border-0 bg-paper p-0 text-sm text-ink backdrop:bg-black/60 dark:bg-night-card dark:text-ink-dark md:m-auto md:max-w-lg md:rounded-xl md:border md:border-paper-border md:p-4 md:dark:border-night-border"
      style={{
        position: "fixed",
        insetInlineStart: 0,
        insetInlineEnd: 0,
        bottom: 0,
        top: "auto",
        maxHeight: "85vh",
      }}
    >
      <div
        ref={sheetRef}
        className="flex max-h-[85vh] flex-col md:max-h-none"
        style={{ transform: dragOffset ? `translateY(${dragOffset}px)` : undefined, transition: dragOffset ? "none" : "transform 0.2s ease-out" }}
      >
        {/* Drag handle — mobile only, this is the swipe-to-dismiss target. */}
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="flex shrink-0 cursor-grab touch-none items-center justify-center py-2 active:cursor-grabbing md:hidden"
        >
          <div className="h-1.5 w-10 rounded-full bg-paper-border dark:bg-night-border" />
        </div>

        <div className="flex shrink-0 items-center justify-between px-4 pb-2 pt-1 md:pt-0">
          <h2 className="text-sm font-semibold">{title}</h2>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="flex min-h-[48px] min-w-[48px] items-center justify-center text-xs underline md:min-h-0 md:min-w-0"
          >
            {closeLabel}
          </button>
        </div>

        <div className="overflow-y-auto px-4 pb-safe md:pb-4">{children}</div>
      </div>
    </dialog>
  );
});

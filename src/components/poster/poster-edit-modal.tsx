"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

import { editPoster, getPosterEditHistory, type PosterEditHistoryEntry } from "@/lib/actions/poster-edit";
import { BottomSheet, type BottomSheetHandle } from "@/components/ui/bottom-sheet";
import { useDict, useLocale } from "@/components/i18n/locale-provider";
import { ActionIcons } from "@/components/icons";
import { Button } from "@/components/ui/button";

// Natural-language poster editing (2026-09-03) — real scope, stated
// plainly in the modal itself via state.reason/editCannotApply copy
// (see the unavailable-state comment below for why state.reason, not a
// static dict string), not just in code comments: template/text/color/image-slot
// changes only, honestly declined otherwise (see the actual prompt in
// prompt.ts's buildPosterEditPrompt). History is fetched lazily on
// first open (a direct call into poster-edit.ts's own "use server"
// export, not a new API route) rather than for every poster on page
// load — this page's own pagination work already exists specifically
// to avoid N+1-style unbounded per-card work.
export function PosterEditModal({ posterId }: { posterId: string }) {
  const dict = useDict().poster;
  const common = useDict().common;
  const locale = useLocale();
  const sheetRef = useRef<BottomSheetHandle>(null);
  const [state, action, pending] = useActionState(editPoster, undefined);
  const router = useRouter();
  const [history, setHistory] = useState<PosterEditHistoryEntry[] | null>(null);
  const [instruction, setInstruction] = useState("");
  // Tracks which success result's instruction field has already been
  // cleared — compared during render (React's own recommended "adjust
  // state while rendering" pattern, see the effect below) rather than
  // via a second setState call inside the effect, which would trigger
  // an extra cascading render for no real benefit here.
  const [clearedForPosterId, setClearedForPosterId] = useState<string | null>(null);
  if (state?.status === "success" && state.posterId !== clearedForPosterId) {
    setClearedForPosterId(state.posterId);
    setInstruction("");
  }

  const quickActions: { label: string; instruction: string }[] = [
    { label: dict.editQuickBolderHeadline, instruction: "Make the headline bigger and bolder for more impact." },
    { label: dict.editQuickNewBackground, instruction: "Generate a completely new background that still fits the brand colors." },
    { label: dict.editQuickDifferentTemplate, instruction: "Switch to a different, more visually striking template." },
    { label: dict.editQuickSimplify, instruction: "Simplify the text — shorter headline and subhead, easier to read at a glance." },
  ];

  useEffect(() => {
    // A successful edit creates a brand-new Poster row (this app never
    // edits in place) — this modal instance stays attached to the
    // ORIGINAL poster it was opened from, whose own history is
    // unaffected, so there's nothing to reset here beyond refreshing
    // the page to show the new sibling card in Media Library.
    if (state?.status === "success") {
      router.refresh();
    }
  }, [state, router]);

  const loadHistory = () => {
    if (history !== null) return;
    getPosterEditHistory(posterId)
      .then(setHistory)
      .catch(() => setHistory([]));
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          sheetRef.current?.showModal();
          loadHistory();
        }}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded border border-paper-border dark:border-night-border px-1.5 py-0.5"
      >
        <ActionIcons.edit size={14} aria-hidden="true" />
        {dict.editWithAI}
      </button>
      <BottomSheet ref={sheetRef} title={dict.editTitle} closeLabel={dict.editCancel}>
        <form action={action} className="flex flex-col gap-3 pb-2">
          <input type="hidden" name="posterId" value={posterId} />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="instruction" className="flex items-center gap-1.5 text-sm font-medium">
              <ActionIcons.aiGenerate size={14} aria-hidden="true" />
              {dict.editInstructionLabel}
            </label>

            <span className="text-xs font-medium text-ink-soft dark:text-ink-soft-dark">{dict.editQuickActionsLabel}</span>
            <div className="flex flex-wrap gap-1.5">
              {quickActions.map((qa) => (
                <button
                  key={qa.label}
                  type="button"
                  onClick={() => setInstruction(qa.instruction)}
                  className="rounded-full border border-paper-border px-2 py-1 text-xs transition-colors hover:border-primary dark:border-night-border dark:hover:border-primary-dark"
                >
                  {qa.label}
                </button>
              ))}
            </div>

            <textarea
              id="instruction"
              name="instruction"
              required
              rows={3}
              dir="auto"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder={dict.editInstructionPlaceholder}
              className="rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-3 py-2 text-base"
            />
          </div>

          {/* Real bug, found live testing against a real account
              (2026-09-04): this used to always render the static
              dict.editUnavailable string, completely ignoring
              state.reason — the server-computed message that correctly
              distinguishes "never configured" from "a real provider
              exists but this one attempt failed" (see shared-pool.ts's
              tryShareWithHonestUnavailable). The distinction was being
              computed correctly and then thrown away before it ever
              reached the screen. state.reason is always a real,
              non-empty string from the server, so it's the one source
              of truth here — dict.editUnavailable is unused now. */}
          {state?.status === "unavailable" && (
            <p role="alert" className="text-sm text-amber-600 dark:text-amber-400">
              {state.reason}
            </p>
          )}
          {state?.status === "cannotApply" && (
            <p role="alert" className="text-sm text-amber-600 dark:text-amber-400">
              {dict.editCannotApply} {state.explanation}
            </p>
          )}
          {state?.status === "error" && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {state.error}
            </p>
          )}
          {state?.status === "success" && (
            <div role="status" className="flex flex-col gap-1 text-sm text-green-700 dark:text-green-400">
              <p>{state.explanation}</p>
              {state.warnings.map((warning) => (
                <p key={warning} className="text-amber-600 dark:text-amber-400">
                  {warning}
                </p>
              ))}
              {/* Real bug fix (2026-09-04): this action's own result
                  already carried a real fallback disclosure when the AI
                  background genuinely degraded to a fallback provider —
                  see poster-edit.ts's own doc comment — but nothing
                  rendered it, so an edit that silently fell back to the
                  brand gradient looked identical to one that fully
                  succeeded. Same real disclosure pattern poster-form.tsx
                  already uses for the same case. */}
              {state.fallbackFrom && state.fallbackFrom.length > 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  {common.fallbackNotice(state.backgroundProviderName ?? dict.backgroundAI, state.fallbackFrom[0].fromProvider)}
                </p>
              )}
            </div>
          )}

          <Button type="submit" pending={pending} pendingLabel={dict.editSubmitting}>
            {dict.editSubmit}
          </Button>
        </form>

        {history && history.length > 1 && (
          <div className="flex flex-col gap-2 border-t border-paper-border dark:border-night-border pt-3">
            <h3 className="text-sm font-semibold">{dict.editHistoryTitle}</h3>
            <ul className="flex flex-col gap-2">
              {history.map((entry) => (
                <li key={entry.posterId} className="flex items-center gap-2.5">
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md border border-paper-border bg-paper-card dark:border-night-border dark:bg-night-card">
                    <Image
                      src={entry.thumbnailUrl}
                      alt={entry.headline}
                      fill
                      sizes="48px"
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                  <div className="flex min-w-0 flex-col text-sm">
                    <span className="truncate font-medium">{entry.editInstruction ?? dict.editHistoryOriginal}</span>
                    <span className="text-xs text-ink-soft dark:text-ink-soft-dark">
                      {new Date(entry.createdAt).toLocaleString(locale === "ar" ? "ar" : "en")}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </BottomSheet>
    </>
  );
}

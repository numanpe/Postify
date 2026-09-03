"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { editPoster, getPosterEditHistory, type PosterEditHistoryEntry } from "@/lib/actions/poster-edit";
import { BottomSheet, type BottomSheetHandle } from "@/components/ui/bottom-sheet";
import { useDict, useLocale } from "@/components/i18n/locale-provider";
import { ActionIcons } from "@/components/icons";
import { Button } from "@/components/ui/button";

// Natural-language poster editing (2026-09-03) — real scope, stated
// plainly in the modal itself via editUnavailable/editCannotApply
// copy, not just in code comments: template/text/color/image-slot
// changes only, honestly declined otherwise (see the actual prompt in
// prompt.ts's buildPosterEditPrompt). History is fetched lazily on
// first open (a direct call into poster-edit.ts's own "use server"
// export, not a new API route) rather than for every poster on page
// load — this page's own pagination work already exists specifically
// to avoid N+1-style unbounded per-card work.
export function PosterEditModal({ posterId }: { posterId: string }) {
  const dict = useDict().poster;
  const locale = useLocale();
  const sheetRef = useRef<BottomSheetHandle>(null);
  const [state, action, pending] = useActionState(editPoster, undefined);
  const router = useRouter();
  const [history, setHistory] = useState<PosterEditHistoryEntry[] | null>(null);

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
          <div className="flex flex-col gap-1">
            <label htmlFor="instruction" className="text-sm font-medium">
              {dict.editInstructionLabel}
            </label>
            <textarea
              id="instruction"
              name="instruction"
              required
              rows={3}
              dir="auto"
              placeholder={dict.editInstructionPlaceholder}
              className="rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-3 py-2 text-base"
            />
          </div>

          {state?.status === "unavailable" && (
            <p role="alert" className="text-sm text-amber-600 dark:text-amber-400">
              {dict.editUnavailable}
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
                <li key={entry.posterId} className="text-sm">
                  <span className="font-medium">{entry.editInstruction ?? dict.editHistoryOriginal}</span>
                  <span className="text-ink-soft dark:text-ink-soft-dark">
                    {" — "}
                    {new Date(entry.createdAt).toLocaleString(locale === "ar" ? "ar" : "en")}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </BottomSheet>
    </>
  );
}

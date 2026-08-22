"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { deleteCompany } from "@/lib/actions/company";
import { BottomSheet, type BottomSheetHandle } from "@/components/ui/bottom-sheet";
import { useDict } from "@/components/i18n/locale-provider";

// Real, permanent deletion — see deleteCompany's own doc comment
// (company.ts) for why this exists and what it actually removes.
// "Type the company name to confirm" is the same pattern GitHub/Vercel
// use for irreversible deletes — deliberately more friction than a
// single confirm() dialog, since this is the single most destructive
// action in the whole app.
export function DeleteCompanySection({ companyName }: { companyName: string }) {
  const dict = useDict().settings;
  const sheetRef = useRef<BottomSheetHandle>(null);
  const [state, action, pending] = useActionState(deleteCompany, undefined);
  const [confirmText, setConfirmText] = useState("");
  const submittedRef = useRef(false);

  const matches = confirmText.trim() === companyName;

  useEffect(() => {
    if (submittedRef.current && !pending && state && "success" in state) {
      // Hard navigation, not router.push() — the company (and its
      // locale) is gone, so <html lang/dir> and LocaleProvider need a
      // full re-resolve, same reasoning as createCompany's redirect.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/create-company";
    }
  }, [pending, state]);

  return (
    <div className="flex flex-col gap-2 rounded-md border border-red-200 dark:border-red-900 p-4">
      <h2 className="text-sm font-semibold text-red-700 dark:text-red-400">{dict.dangerZoneTitle}</h2>
      <p className="text-xs text-ink-soft dark:text-ink-soft-dark">{dict.dangerZoneSubtitle}</p>
      <div>
        <button
          type="button"
          onClick={() => sheetRef.current?.showModal()}
          className="min-h-[48px] rounded-md border border-red-300 px-3 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
        >
          {dict.deleteCompanyButton}
        </button>
      </div>

      <BottomSheet ref={sheetRef} title={dict.deleteCompanyConfirmTitle} closeLabel={dict.deleteCompanyCancel}>
        <form
          action={action}
          onSubmit={() => {
            submittedRef.current = true;
          }}
          className="flex flex-col gap-3 pb-3"
        >
          <p className="text-sm">{dict.deleteCompanyConfirmBody(companyName)}</p>

          <div className="flex flex-col gap-1">
            <label htmlFor="confirmName" className="text-sm font-medium">
              {dict.deleteCompanyConfirmLabel(companyName)}
            </label>
            <input
              id="confirmName"
              name="confirmName"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={dict.deleteCompanyConfirmPlaceholder}
              autoComplete="off"
              className="rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-3 py-2 text-base"
            />
          </div>

          {state && "error" in state && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}

          <div className="flex gap-2">
            {/* Not the shared Button component — that's brand-red by
                default via its own base classes, and per its own doc
                comment, a passed className can lose the specificity
                race against them (same generated-stylesheet-order
                pitfall it already documents for its `size` prop). A
                plain button avoids that risk entirely for this one
                genuinely different (destructive-red, not brand-red)
                case. */}
            <button
              type="submit"
              disabled={!matches || pending}
              className="inline-flex min-h-[48px] items-center rounded-lg bg-red-600 px-4 text-base font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-red-700 dark:hover:bg-red-600"
            >
              {pending ? dict.deleteCompanyDeleting : dict.deleteCompanySubmit}
            </button>
            <button
              type="button"
              onClick={() => sheetRef.current?.close()}
              className="min-h-[48px] px-3 text-sm font-medium text-ink-soft dark:text-ink-soft-dark"
            >
              {dict.deleteCompanyCancel}
            </button>
          </div>
        </form>
      </BottomSheet>
    </div>
  );
}

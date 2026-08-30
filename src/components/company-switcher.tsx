"use client";

import { useActionState, useEffect } from "react";

import { switchActiveCompany } from "@/lib/actions/company";
import { useDict } from "@/components/i18n/locale-provider";

// Only rendered by (app)/layout.tsx when a user has more than one real
// company (CompanyMember row) — most users have exactly one, and keep
// seeing the plain company-name label they always have. A hard
// window.location reload on success (not router.refresh()) matches
// create-company-form.tsx's own established reasoning: <html lang/dir>
// and LocaleProvider are resolved once in the root layout and won't
// re-run on a soft client-router transition, so switching to a company
// with a different locale needs a real navigation to actually show it.
export function CompanySwitcher({
  companies,
  activeCompanyId,
}: {
  companies: { id: string; name: string }[];
  activeCompanyId: string;
}) {
  const dict = useDict().company;
  const [state, action, pending] = useActionState(switchActiveCompany, undefined);

  useEffect(() => {
    if (state && "success" in state) {
      window.location.reload();
    }
  }, [state]);

  return (
    <form action={action} className="flex items-center gap-1.5">
      <select
        name="companyId"
        defaultValue={activeCompanyId}
        disabled={pending}
        aria-label={dict.switcherLabel}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className="rounded border border-paper-border dark:border-night-border bg-paper text-sm text-ink dark:bg-night-card dark:text-ink-dark px-1.5 py-0.5 disabled:opacity-60"
      >
        {companies.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      {state && "error" in state && <span className="text-xs text-red-600 dark:text-red-400">{dict.switchError}</span>}
    </form>
  );
}

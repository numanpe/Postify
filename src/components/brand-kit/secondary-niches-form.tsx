"use client";

import { useActionState } from "react";

import { updateCompanyNiches } from "@/lib/actions/company";
import { Button } from "@/components/ui/button";
import { useDict } from "@/components/i18n/locale-provider";

// The one edit path for Company.secondaryNiches after onboarding —
// previously onboarding's one-time submit was the only writer. Feeds
// directly into every generated caption/script/campaign-brief's
// nicheLine (prompt.ts, template-provider.ts), so a stale or mistyped
// value here had no way to be corrected before this existed.
export function SecondaryNichesForm({ secondaryNiches }: { secondaryNiches: string[] }) {
  const [state, action, pending] = useActionState(updateCompanyNiches, undefined);
  const dict = useDict();

  return (
    <form action={action} className="flex flex-col gap-1">
      <label htmlFor="secondaryNiches" className="text-sm font-medium">
        {dict.onboarding.secondaryNiches}{" "}
        <span className="font-normal text-ink-soft dark:text-ink-soft-dark">{dict.onboarding.secondaryNichesHint}</span>
      </label>
      <input
        id="secondaryNiches"
        name="secondaryNiches"
        defaultValue={secondaryNiches.join(", ")}
        placeholder={dict.onboarding.secondaryNichesPlaceholder}
        className="rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-3 py-2 text-base"
      />
      {state && "error" in state && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
      {state && "success" in state && (
        <p className="text-sm text-green-700 dark:text-green-400">{dict.settings.voiceEngineSaved}</p>
      )}
      <div>
        <Button type="submit" size="sm" pending={pending} pendingLabel={dict.common.save}>
          {dict.common.save}
        </Button>
      </div>
    </form>
  );
}

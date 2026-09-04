"use client";

import { useActionState } from "react";

import { updateInactivityNudgePreference } from "@/lib/actions/weekly-digest-settings";
import { Button } from "@/components/ui/button";
import { useDict } from "@/components/i18n/locale-provider";

async function action(_prevState: { saved: boolean }, formData: FormData) {
  await updateInactivityNudgePreference(formData);
  return { saved: true };
}

export function InactivityNudgeToggle({ enabled }: { enabled: boolean }) {
  const [state, formAction, pending] = useActionState(action, { saved: false });
  const dict = useDict().settings;

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold">{dict.inactivityNudgeTitle}</h2>
        <p className="text-sm text-ink-soft dark:text-ink-soft-dark">{dict.inactivityNudgeSubtitle}</p>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="inactivityNudgeEnabled" defaultChecked={enabled} className="h-5 w-5 accent-current" />
        {dict.inactivityNudgeLabel}
      </label>

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" pending={pending}>
          {dict.inactivityNudgeSave}
        </Button>
        {state.saved && !pending && (
          <span className="text-sm text-green-700 dark:text-green-400">{dict.inactivityNudgeSaved}</span>
        )}
      </div>
    </form>
  );
}

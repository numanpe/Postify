"use client";

import { useTransition } from "react";

import { setRecurringPlanPaused, deleteRecurringPlan } from "@/lib/actions/recurring-plan";
import { useDict } from "@/components/i18n/locale-provider";

export function RecurringPlanControls({ isPaused }: { isPaused: boolean }) {
  const dict = useDict().recurringPlan;
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => void setRecurringPlanPaused(!isPaused))}
        className="rounded-md border border-paper-border dark:border-night-border px-3 py-1.5 text-sm font-medium disabled:opacity-50"
      >
        {isPaused ? dict.resume : dict.pause}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (window.confirm(dict.deleteConfirm)) {
            startTransition(() => void deleteRecurringPlan());
          }
        }}
        className="rounded-md border border-paper-border dark:border-night-border px-3 py-1.5 text-sm font-medium text-red-600 disabled:opacity-50 dark:text-red-400"
      >
        {dict.deleteButton}
      </button>
    </div>
  );
}

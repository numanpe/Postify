"use client";

import { useActionState } from "react";

import { createCampaign } from "@/lib/actions/campaign";
import { Button } from "@/components/ui/button";
import { useDict } from "@/components/i18n/locale-provider";

export function CampaignForm() {
  const [state, action, pending] = useActionState(createCampaign, undefined);
  const today = new Date().toISOString().slice(0, 10);
  const dict = useDict().campaigns;

  return (
    <form action={action} className="flex w-full max-w-md flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="objective" className="text-sm font-medium">
          {dict.objective}
        </label>
        <input
          id="objective"
          name="objective"
          required
          placeholder={dict.objectivePlaceholder}
          className="rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-3 py-2 text-base"
        />
      </div>

      <div className="flex gap-4">
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="startDate" className="text-sm font-medium">
            {dict.startDate}
          </label>
          <input
            id="startDate"
            name="startDate"
            type="date"
            defaultValue={today}
            required
            className="rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-3 py-2 text-base"
          />
        </div>
        <div className="flex w-28 flex-col gap-1">
          <label htmlFor="days" className="text-sm font-medium">
            {dict.days}
          </label>
          <input
            id="days"
            name="days"
            type="number"
            min={1}
            max={14}
            defaultValue={7}
            required
            className="rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-3 py-2 text-base"
          />
        </div>
      </div>

      {state?.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}

      <Button type="submit" pending={pending} pendingLabel={dict.submitPending}>
        {dict.submit}
      </Button>
    </form>
  );
}

"use client";

import { useActionState } from "react";

import { updateTargetMarket } from "@/lib/actions/company";
import { Button } from "@/components/ui/button";
import { useDict } from "@/components/i18n/locale-provider";

// Part A of the local-content-awareness work — free text, not a
// geographic radius (see Company.targetMarket's own schema comment).
// Feeds directly into every generated caption/script/campaign-brief's
// marketLine and the free tier's real marketLine/deriveMarketHashtags
// (prompt.ts, template-provider.ts). Same edit-after-onboarding pattern
// as SecondaryNichesForm right above it.
export function TargetMarketForm({ targetMarket }: { targetMarket: string | null }) {
  const [state, action, pending] = useActionState(updateTargetMarket, undefined);
  const dict = useDict();

  return (
    <form action={action} className="flex flex-col gap-1">
      <label htmlFor="targetMarket" className="text-sm font-medium">
        {dict.onboarding.targetMarket}{" "}
        <span className="font-normal text-ink-soft dark:text-ink-soft-dark">{dict.onboarding.targetMarketHint}</span>
      </label>
      <input
        id="targetMarket"
        name="targetMarket"
        defaultValue={targetMarket ?? ""}
        maxLength={200}
        placeholder={dict.onboarding.targetMarketPlaceholder}
        className="rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-3 py-2 text-base"
      />
      {state && "error" in state && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
      {state && "success" in state && (
        <p role="status" className="text-sm text-green-700 dark:text-green-400">
          {dict.settings.voiceEngineSaved}
        </p>
      )}
      <div>
        <Button type="submit" size="sm" pending={pending} pendingLabel={dict.common.save}>
          {dict.common.save}
        </Button>
      </div>
    </form>
  );
}

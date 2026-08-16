"use client";

import { useActionState } from "react";

import { generateCaption } from "@/lib/actions/content";
import { Button } from "@/components/ui/button";
import { useDict } from "@/components/i18n/locale-provider";

export function GenerateCaptionForm() {
  const [state, action, pending] = useActionState(generateCaption, undefined);
  const dict = useDict().studio;

  return (
    <div className="flex w-full max-w-lg flex-col gap-4">
      <form action={action} className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          name="topic"
          placeholder={dict.topicPlaceholder}
          required
          className="flex-1 rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-3 py-2 text-base"
        />
        <Button type="submit" pending={pending} pendingLabel={dict.generating} size="sm">
          {dict.generate}
        </Button>
      </form>

      {state?.status === "error" && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}

      {state?.status === "success" && (
        <div className="flex flex-col gap-2 rounded-md border border-paper-border dark:border-night-border p-4">
          <p className="text-base">{state.text}</p>
          <p className="text-xs text-ink-soft dark:text-ink-soft-dark">
            {state.providerName}
            {state.model ? ` · ${state.model}` : ""}
            {typeof state.estimatedCostUsd === "number"
              ? ` · ~$${state.estimatedCostUsd.toFixed(4)}`
              : ""}
          </p>
        </div>
      )}
    </div>
  );
}

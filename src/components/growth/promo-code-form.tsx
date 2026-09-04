"use client";

import { useActionState } from "react";

import { createPromoCode } from "@/lib/actions/promo-codes";
import { Button } from "@/components/ui/button";
import { useDict } from "@/components/i18n/locale-provider";

export function PromoCodeForm() {
  const [state, action, pending] = useActionState(createPromoCode, undefined);
  const dict = useDict().promoCodes;

  return (
    <form action={action} className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <div className="flex flex-1 flex-col gap-1">
        <label htmlFor="label" className="text-sm font-medium">
          {dict.labelInput}
        </label>
        <input
          id="label"
          name="label"
          type="text"
          maxLength={60}
          placeholder={dict.labelPlaceholder}
          className="rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-3 py-2 text-base"
        />
      </div>
      <Button type="submit" pending={pending} pendingLabel="…">
        {dict.createButton}
      </Button>
      {state?.status === "error" && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
    </form>
  );
}

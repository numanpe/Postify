"use client";

import { useActionState } from "react";

import { updateBrandKit } from "@/lib/actions/brand-kit";
import { Button } from "@/components/ui/button";

type BrandKitDefaults = {
  primaryColor: string | null;
  secondaryColor: string | null;
  accentColor: string | null;
  fontHeading: string | null;
  fontBody: string | null;
} | null;

export function BrandKitForm({ brandKit }: { brandKit: BrandKitDefaults }) {
  const [state, action, pending] = useActionState(updateBrandKit, undefined);

  return (
    <form action={action} className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="logo" className="text-sm font-medium">
          Logo
        </label>
        <input id="logo" name="logo" type="file" accept="image/*" className="text-sm" />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="primaryColor" className="text-sm font-medium">
            Primary
          </label>
          <input
            id="primaryColor"
            name="primaryColor"
            placeholder="#1A2B3C"
            defaultValue={brandKit?.primaryColor ?? ""}
            className="rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-2 py-1 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="secondaryColor" className="text-sm font-medium">
            Secondary
          </label>
          <input
            id="secondaryColor"
            name="secondaryColor"
            placeholder="#1A2B3C"
            defaultValue={brandKit?.secondaryColor ?? ""}
            className="rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-2 py-1 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="accentColor" className="text-sm font-medium">
            Accent
          </label>
          <input
            id="accentColor"
            name="accentColor"
            placeholder="#1A2B3C"
            defaultValue={brandKit?.accentColor ?? ""}
            className="rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-2 py-1 text-sm"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="fontHeading" className="text-sm font-medium">
          Heading font
        </label>
        <input
          id="fontHeading"
          name="fontHeading"
          defaultValue={brandKit?.fontHeading ?? ""}
          className="rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-3 py-2 text-base"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="fontBody" className="text-sm font-medium">
          Body font
        </label>
        <input
          id="fontBody"
          name="fontBody"
          defaultValue={brandKit?.fontBody ?? ""}
          className="rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-3 py-2 text-base"
        />
      </div>

      {state?.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}

      <Button type="submit" pending={pending} pendingLabel="Saving…">
        Save Brand Kit
      </Button>
    </form>
  );
}

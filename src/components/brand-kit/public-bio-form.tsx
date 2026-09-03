"use client";

import { useActionState } from "react";

import { updatePublicBioSettings } from "@/lib/actions/public-bio";
import { Button } from "@/components/ui/button";
import { useDict } from "@/components/i18n/locale-provider";

export function PublicBioForm({
  bioUrl,
  enabled,
  websiteUrl,
  whatsappNumber,
  phone,
  contactEmail,
}: {
  bioUrl: string;
  enabled: boolean;
  websiteUrl: string | null;
  whatsappNumber: string | null;
  phone: string | null;
  contactEmail: string | null;
}) {
  const [state, action, pending] = useActionState(updatePublicBioSettings, undefined);
  const dict = useDict().brandKit;

  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold">{dict.bioTitle}</h2>
        <p className="text-sm text-ink-soft dark:text-ink-soft-dark">{dict.bioSubtitle}</p>
      </div>

      <p className="text-sm">
        {dict.bioLinkLabel}{" "}
        <a href={bioUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
          {bioUrl}
        </a>
      </p>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="publicBioEnabled" defaultChecked={enabled} className="h-5 w-5 accent-current" />
        {dict.bioEnabledLabel}
      </label>

      <div className="flex flex-col gap-1">
        <label htmlFor="websiteUrl" className="text-sm font-medium">
          {dict.bioWebsiteLabel}
        </label>
        <input
          id="websiteUrl"
          name="websiteUrl"
          type="url"
          defaultValue={websiteUrl ?? ""}
          placeholder={dict.bioWebsitePlaceholder}
          className="rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-3 py-2 text-base"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="whatsappNumber" className="text-sm font-medium">
          {dict.bioWhatsappLabel}
        </label>
        <input
          id="whatsappNumber"
          name="whatsappNumber"
          type="tel"
          defaultValue={whatsappNumber ?? ""}
          placeholder={dict.bioWhatsappPlaceholder}
          className="rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-3 py-2 text-base"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="phone" className="text-sm font-medium">
          {dict.bioPhoneLabel}
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          defaultValue={phone ?? ""}
          placeholder={dict.bioPhonePlaceholder}
          className="rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-3 py-2 text-base"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="contactEmail" className="text-sm font-medium">
          {dict.bioContactEmailLabel}
        </label>
        <input
          id="contactEmail"
          name="contactEmail"
          type="email"
          defaultValue={contactEmail ?? ""}
          placeholder={dict.bioContactEmailPlaceholder}
          className="rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-3 py-2 text-base"
        />
      </div>

      {state && "error" in state && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
      {state && "success" in state && (
        <p role="status" className="text-sm text-green-700 dark:text-green-400">
          {dict.bioSaved}
        </p>
      )}

      <div>
        <Button type="submit" size="sm" pending={pending} pendingLabel={dict.bioSave}>
          {dict.bioSave}
        </Button>
      </div>
    </form>
  );
}

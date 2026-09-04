"use client";

import { useActionState } from "react";

import { submitTestimonial } from "@/lib/actions/testimonial";

export interface TestimonialFormStrings {
  nameLabel: string;
  nameOptional: string;
  textLabel: string;
  textPlaceholder: string;
  submit: string;
  submitting: string;
  thankYouTitle: string;
  thankYouBody: string;
}

// Public route — no LocaleProvider here (it only wraps the
// authenticated (app) layout, see src/app/(app)/layout.tsx's own
// comment), so strings come in as plain props computed server-side by
// the page, same convention /bio/[slug]/page.tsx already established
// for this exact "public page, no session context" situation.
export function TestimonialForm({
  slug,
  accentColor,
  dir,
  t,
}: {
  slug: string;
  accentColor: string;
  dir: "ltr" | "rtl";
  t: TestimonialFormStrings;
}) {
  const boundAction = submitTestimonial.bind(null, slug);
  const [state, action, pending] = useActionState(boundAction, undefined);

  if (state?.status === "success") {
    return (
      <div className="flex flex-col items-center gap-2 text-center">
        <h2 className="text-lg font-semibold">{t.thankYouTitle}</h2>
        <p className="text-sm text-ink-soft dark:text-ink-soft-dark">{t.thankYouBody}</p>
      </div>
    );
  }

  return (
    <form action={action} dir={dir} className="flex w-full max-w-sm flex-col gap-3 text-start">
      <div className="flex flex-col gap-1">
        <label htmlFor="customerName" className="text-sm font-medium">
          {t.nameLabel} <span className="text-ink-soft dark:text-ink-soft-dark">{t.nameOptional}</span>
        </label>
        <input
          id="customerName"
          name="customerName"
          type="text"
          maxLength={40}
          className="rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-3 py-2 text-base"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="text" className="text-sm font-medium">
          {t.textLabel}
        </label>
        <textarea
          id="text"
          name="text"
          required
          minLength={5}
          maxLength={150}
          rows={4}
          placeholder={t.textPlaceholder}
          className="rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-3 py-2 text-base"
        />
      </div>

      {state?.status === "error" && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="min-h-[48px] rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        style={{ backgroundColor: accentColor }}
      >
        {pending ? t.submitting : t.submit}
      </button>
    </form>
  );
}

"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { createCompany } from "@/lib/actions/company";
import { INDUSTRIES } from "@/lib/industries";
import { dictionaries, type Locale } from "@/lib/i18n/dictionaries";
import { Button } from "@/components/ui/button";

// The one place in the app that renders before a Company (and therefore
// a locale) exists — the user picks it right here. Unlike every other
// component, this can't read locale from <LocaleProvider> (that reflects
// the server-resolved company locale, which doesn't exist yet), so it
// keeps its own local preview state and renders live in the chosen
// language/direction as soon as it's picked, not just after submit.
export function CreateCompanyForm() {
  const [state, action, pending] = useActionState(createCompany, undefined);
  const [locale, setLocale] = useState<Locale>("en");
  const dict = dictionaries[locale].onboarding;
  const dir = locale === "ar" ? "rtl" : "ltr";
  const submittedRef = useRef(false);

  // A plain next/navigation redirect() (or useRouter().push(), which the
  // lint rule below wants) after creating the company would be a soft
  // client-router transition, which doesn't re-run the root layout —
  // <html lang/dir> and <LocaleProvider> would keep showing whatever
  // locale was current before this company (and its locale) existed. A
  // genuine hard navigation is required here, not a lint-rule violation.
  //
  // Routes through /studio?showGeminiStep=1 rather than rendering
  // GeminiOnboardingStep on this page — real bug found via Playwright:
  // a Server Action invoked from a form still mounted here triggers
  // Next.js's automatic refresh of this page's Server Component tree,
  // which re-runs create-company/page.tsx's own "already has a company?
  // redirect to /media" check now that the company genuinely exists,
  // racing against (and sometimes beating) this file's own navigation.
  // /studio has no equivalent redirect, so showing the step there is
  // race-free — see studio/page.tsx.
  useEffect(() => {
    if (submittedRef.current && !pending && state && "success" in state) {
      // Part B3.1: land directly in the guided wizard, not a generic
      // dashboard — same redirect target as the website-extracted path
      // (website-first-onboarding.tsx). No firstTopic query param here
      // since the manual path has no extracted description to derive
      // one from — an empty Step 1 topic field is the honest default,
      // not a fabricated suggestion.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/studio?showGeminiStep=1";
    }
  }, [pending, state]);

  return (
    <form
      action={action}
      onSubmit={() => {
        submittedRef.current = true;
      }}
      dir={dir}
      style={locale === "ar" ? { fontFamily: "var(--font-tajawal), system-ui, sans-serif" } : undefined}
      className="flex w-full max-w-sm flex-col gap-4"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="name" className="text-sm font-medium">
          {dict.companyName}
        </label>
        <input
          id="name"
          name="name"
          required
          className="rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-3 py-2 text-base"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="primaryIndustry" className="text-sm font-medium">
          {dict.primaryIndustry}
        </label>
        <select
          id="primaryIndustry"
          name="primaryIndustry"
          required
          defaultValue=""
          className="rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-3 py-2 text-base"
        >
          <option value="" disabled>
            {dict.selectIndustry}
          </option>
          {INDUSTRIES.map((industry) => (
            <option key={industry} value={industry}>
              {industry}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="secondaryNiches" className="text-sm font-medium">
          {dict.secondaryNiches}{" "}
          <span className="font-normal text-ink-soft dark:text-ink-soft-dark">{dict.secondaryNichesHint}</span>
        </label>
        <input
          id="secondaryNiches"
          name="secondaryNiches"
          placeholder={dict.secondaryNichesPlaceholder}
          className="rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-3 py-2 text-base"
        />
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium">{dict.language}</span>
        <div className="flex gap-2" role="radiogroup" aria-label={dict.language}>
          {(["en", "ar"] as const).map((option) => (
            <label
              key={option}
              className={`flex-1 cursor-pointer rounded-md border px-3 py-2 text-center text-sm font-medium ${
                locale === option
                  ? "border-primary bg-primary text-paper dark:border-primary-dark dark:bg-primary-dark dark:text-night"
                  : "border-paper-border text-ink dark:border-night-border dark:text-ink-dark"
              }`}
            >
              <input
                type="radio"
                name="locale"
                value={option.toUpperCase()}
                checked={locale === option}
                onChange={() => setLocale(option)}
                className="sr-only"
              />
              {option === "en" ? "English" : "العربية"}
            </label>
          ))}
        </div>
        <span className="text-xs text-ink-soft dark:text-ink-soft-dark">{dict.languageHint}</span>
      </div>

      {state && "error" in state && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}

      <Button type="submit" pending={pending} pendingLabel={dict.submitPending}>
        {dict.submit}
      </Button>
    </form>
  );
}

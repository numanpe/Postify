"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Image from "next/image";

import { extractOnboardingContext, createCompanyFromOnboarding } from "@/lib/actions/onboarding";
import { INDUSTRIES } from "@/lib/industries";
import { dictionaries, type Locale } from "@/lib/i18n/dictionaries";
import { Button } from "@/components/ui/button";
import { CreateCompanyForm } from "@/components/onboarding/create-company-form";

const fieldClass =
  "rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-3 py-2 text-base";

// Part B2: leads with the website importer instead of a blank manual
// form. Same pre-locale-context constraint as CreateCompanyForm (no
// Company exists yet, so no <LocaleProvider> to read from) — keeps its
// own local locale state, rendered live in the chosen language/
// direction. The "I'll set this up manually" path renders the existing
// CreateCompanyForm completely unchanged, per the spec's explicit
// instruction not to force website extraction.
export function WebsiteFirstOnboarding() {
  const [path, setPath] = useState<"website" | "manual">("website");
  const [locale, setLocale] = useState<Locale>("en");
  const dict = dictionaries[locale].onboarding;
  const dir = locale === "ar" ? "rtl" : "ltr";

  const [extractState, extractAction, extracting] = useActionState(extractOnboardingContext, undefined);

  if (path === "manual") {
    return (
      <div className="flex flex-col items-center gap-4">
        <CreateCompanyForm />
        <button
          type="button"
          onClick={() => setPath("website")}
          className="text-sm font-medium text-ink-soft underline dark:text-ink-soft-dark"
        >
          {dict.backToWebsite}
        </button>
      </div>
    );
  }

  return (
    <div
      dir={dir}
      style={locale === "ar" ? { fontFamily: "var(--font-tajawal), system-ui, sans-serif" } : undefined}
      className="flex w-full max-w-lg flex-col gap-6"
    >
      <div className="flex flex-col gap-3 rounded-md border border-paper-border p-4 dark:border-night-border">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold">{dict.websiteFirstTitle}</h2>
          <p className="text-sm text-ink-soft dark:text-ink-soft-dark">{dict.websiteFirstSubtitle}</p>
        </div>
        <form action={extractAction} className="flex gap-2">
          <input
            name="websiteUrl"
            type="text"
            placeholder={dict.websiteUrlPlaceholder}
            aria-label={dict.websiteUrlPlaceholder}
            required
            className={`${fieldClass} flex-1`}
          />
          <Button type="submit" pending={extracting} pendingLabel={dict.extracting}>
            {dict.extractButton}
          </Button>
        </form>
        {extractState?.status === "error" && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {extractState.error}
          </p>
        )}
        <button
          type="button"
          onClick={() => setPath("manual")}
          className="w-fit text-sm font-medium text-ink-soft underline dark:text-ink-soft-dark"
        >
          {dict.skipManual}
        </button>
      </div>

      {extractState?.status === "success" && (
        <OnboardingReview
          locale={locale}
          setLocale={setLocale}
          dict={dict}
          assets={extractState.assets}
          businessContext={extractState.businessContext}
          suggestedIndustry={extractState.suggestedIndustry}
        />
      )}
    </div>
  );
}

function OnboardingReview({
  locale,
  setLocale,
  dict,
  assets,
  businessContext,
  suggestedIndustry,
}: {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  dict: (typeof dictionaries)["en"]["onboarding"];
  assets: {
    logoUrl: string | null;
    colors: string[];
    fontFamilies: string[];
    suggestedName: string | null;
  };
  businessContext: { description: string; products: string[]; tone: string };
  suggestedIndustry: (typeof INDUSTRIES)[number] | null;
}) {
  const [state, action, pending] = useActionState(createCompanyFromOnboarding, undefined);
  const submittedRef = useRef(false);

  const [name, setName] = useState(assets.suggestedName ?? "");
  const [primaryIndustry, setPrimaryIndustry] = useState<string>(suggestedIndustry ?? "");
  const [secondaryNiches, setSecondaryNiches] = useState(businessContext.products.join(", "));
  const [description, setDescription] = useState(businessContext.description);
  const [tone, setTone] = useState(businessContext.tone);
  const [primaryColor, setPrimaryColor] = useState(assets.colors[0] ?? "");
  const [secondaryColor, setSecondaryColor] = useState(assets.colors[1] ?? "");
  const [accentColor, setAccentColor] = useState(assets.colors[2] ?? "");
  const [fontHeading, setFontHeading] = useState(assets.fontFamilies[0] ?? "");
  const [fontBody, setFontBody] = useState(assets.fontFamilies[1] ?? assets.fontFamilies[0] ?? "");
  const [keepLogo, setKeepLogo] = useState(Boolean(assets.logoUrl));

  // Part B3.2: a real, honest suggestion derived from what was actually
  // extracted — the first mentioned product/service if there is one
  // (a concrete, postable idea), otherwise the description's first
  // clause. Never a fabricated "AI analyzed your brand" claim.
  const suggestedTopic = businessContext.products[0]
    ? `Introducing ${businessContext.products[0]}`
    : (description.split(/[.!?]/)[0]?.trim() ?? "");

  // Real bug found via Playwright, not inspection: rendering
  // GeminiOnboardingStep as a step on THIS page (still /create-company)
  // and letting it call saveProviderCredential() here raced against
  // /create-company/page.tsx's own "already has a company? redirect to
  // /media" check — any Server Action invoked from a page triggers
  // Next.js's automatic refresh of that page's Server Component tree,
  // which re-ran that redirect now that the company genuinely exists,
  // sometimes winning the race against this file's own
  // window.location.href navigation. Fixed by never rendering
  // GeminiOnboardingStep here at all — hard-navigate to /studio
  // immediately (original behavior) and let /studio itself show the
  // step (studio/page.tsx has no competing "already set up" redirect).
  useEffect(() => {
    if (submittedRef.current && !pending && state && "success" in state) {
      const params = new URLSearchParams({ showGeminiStep: "1" });
      if (suggestedTopic) params.set("firstTopic", suggestedTopic);
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = `/studio?${params.toString()}`;
    }
    // suggestedTopic intentionally omitted — recomputing it after submit
    // (fields are no longer editable at that point) would be redundant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, state]);

  return (
    <form
      action={action}
      onSubmit={() => {
        submittedRef.current = true;
      }}
      className="flex flex-col gap-5 rounded-md border border-paper-border p-4 dark:border-night-border"
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">{dict.reviewTitle}</h2>
        <p className="text-sm text-ink-soft dark:text-ink-soft-dark">{dict.reviewSubtitle}</p>
      </div>

      <input type="hidden" name="locale" value={locale.toUpperCase()} />

      <div className="flex flex-col gap-1">
        <label htmlFor="ob-name" className="text-sm font-medium">
          {dict.companyName}
        </label>
        <input id="ob-name" name="name" required value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="ob-industry" className="text-sm font-medium">
          {dict.primaryIndustry} {suggestedIndustry && <span className="font-normal text-ink-soft dark:text-ink-soft-dark">{dict.industrySuggestedHint}</span>}
        </label>
        <select
          id="ob-industry"
          name="primaryIndustry"
          required
          value={primaryIndustry}
          onChange={(e) => setPrimaryIndustry(e.target.value)}
          className={fieldClass}
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
        <label htmlFor="ob-niches" className="text-sm font-medium">
          {dict.secondaryNiches} <span className="font-normal text-ink-soft dark:text-ink-soft-dark">{dict.secondaryNichesHint}</span>
        </label>
        <input
          id="ob-niches"
          name="secondaryNiches"
          value={secondaryNiches}
          onChange={(e) => setSecondaryNiches(e.target.value)}
          className={fieldClass}
        />
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium">{dict.reviewLogo}</span>
        {assets.logoUrl ? (
          <div className="flex items-center gap-2">
            <Image
              src={assets.logoUrl}
              alt=""
              width={40}
              height={40}
              unoptimized
              className="h-10 w-10 rounded border border-paper-border object-contain dark:border-night-border"
            />
            <label className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" checked={keepLogo} onChange={(e) => setKeepLogo(e.target.checked)} />
              {dict.reviewLogo}
            </label>
          </div>
        ) : (
          <p className="text-sm text-ink-soft dark:text-ink-soft-dark">{dict.reviewNoLogo}</p>
        )}
        <input type="hidden" name="logoImportUrl" value={keepLogo ? (assets.logoUrl ?? "") : ""} />
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium">{dict.reviewColors}</span>
        {assets.colors.length > 0 ? (
          <div className="grid grid-cols-3 gap-2">
            <input name="primaryColor" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className={`${fieldClass} px-2 py-1`} />
            <input name="secondaryColor" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className={`${fieldClass} px-2 py-1`} />
            <input name="accentColor" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className={`${fieldClass} px-2 py-1`} />
          </div>
        ) : (
          <>
            <p className="text-sm text-ink-soft dark:text-ink-soft-dark">{dict.reviewNoColors}</p>
            <input type="hidden" name="primaryColor" value="" />
            <input type="hidden" name="secondaryColor" value="" />
            <input type="hidden" name="accentColor" value="" />
          </>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium">{dict.reviewFonts}</span>
        {assets.fontFamilies.length > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            <input name="fontHeading" value={fontHeading} onChange={(e) => setFontHeading(e.target.value)} className={fieldClass} />
            <input name="fontBody" value={fontBody} onChange={(e) => setFontBody(e.target.value)} className={fieldClass} />
          </div>
        ) : (
          <>
            <p className="text-sm text-ink-soft dark:text-ink-soft-dark">{dict.reviewNoFonts}</p>
            <input type="hidden" name="fontHeading" value="" />
            <input type="hidden" name="fontBody" value="" />
          </>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="ob-description" className="text-sm font-medium">
          {dict.reviewDescription}
        </label>
        <textarea
          id="ob-description"
          name="businessDescription"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={fieldClass}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="ob-tone" className="text-sm font-medium">
          {dict.reviewTone}
        </label>
        <input id="ob-tone" name="tone" value={tone} onChange={(e) => setTone(e.target.value)} className={fieldClass} />
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
              <input type="radio" checked={locale === option} onChange={() => setLocale(option)} className="sr-only" />
              {option === "en" ? "English" : "العربية"}
            </label>
          ))}
        </div>
      </div>

      {state && "error" in state && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}

      <Button type="submit" pending={pending} pendingLabel={dict.creating}>
        {dict.createAndContinue}
      </Button>
    </form>
  );
}

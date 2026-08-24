"use client";

import { useActionState, useEffect, useRef } from "react";

import { saveProviderCredential } from "@/lib/actions/provider-credentials";
import { Button } from "@/components/ui/button";
import type { dictionaries } from "@/lib/i18n/dictionaries";

// Part 3c: shown once, right after company creation succeeds (both the
// website-first and manual onboarding paths render this the same way),
// before landing in the main app. saveProviderCredential() is the exact
// same server action Settings uses — this is a focused, low-friction
// presentation of it, not a separate credential-saving path. Genuinely
// skippable: onDone() fires identically whether the key was saved or
// the user clicked Skip, since the app works fully on templates either
// way (free-first principle).
export function GeminiOnboardingStep({
  dict,
  onDone,
}: {
  dict: (typeof dictionaries)["en"]["onboarding"];
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(saveProviderCredential, undefined);
  const submittedRef = useRef(false);

  useEffect(() => {
    // saveProviderCredential returns undefined on success (only
    // {error} on failure) — submittedRef distinguishes that from the
    // pre-submission undefined state.
    if (submittedRef.current && !pending && state === undefined) {
      onDone();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, state]);

  return (
    <div className="flex w-full max-w-lg flex-col gap-4 rounded-md border border-paper-border p-4 dark:border-night-border">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">{dict.geminiStepTitle}</h2>
        <p className="text-sm text-ink-soft dark:text-ink-soft-dark">{dict.geminiStepBody}</p>
      </div>
      <p className="text-xs text-ink-soft dark:text-ink-soft-dark">{dict.geminiStepDisclosure}</p>
      <a
        href="https://aistudio.google.com/apikey"
        target="_blank"
        rel="noopener noreferrer"
        className="w-fit text-sm font-medium text-primary hover:underline dark:text-primary-dark"
      >
        {dict.geminiStepGetKeyLink}
      </a>
      <form
        action={action}
        onSubmit={() => {
          submittedRef.current = true;
        }}
        className="flex flex-col gap-3"
      >
        <input type="hidden" name="provider" value="GEMINI" />
        <input
          name="apiKey"
          type="password"
          autoComplete="off"
          placeholder={dict.geminiStepApiKeyPlaceholder}
          required
          className="rounded-md border border-paper-border dark:border-night-border bg-paper text-ink dark:bg-night-card dark:text-ink-dark px-3 py-2 font-mono text-base"
        />
        {state?.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
        <div className="flex items-center gap-4">
          <Button type="submit" pending={pending} pendingLabel={dict.geminiStepConnecting}>
            {dict.geminiStepConnect}
          </Button>
          <button
            type="button"
            onClick={onDone}
            className="text-sm font-medium text-ink-soft underline dark:text-ink-soft-dark"
          >
            {dict.geminiStepSkip}
          </button>
        </div>
      </form>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";

import { GeminiOnboardingStep } from "@/components/onboarding/gemini-onboarding-step";
import type { dictionaries } from "@/lib/i18n/dictionaries";

// Hosts GeminiOnboardingStep on /studio (not /create-company — see that
// page's own comment for the real race-condition bug this avoids) when
// arriving via ?showGeminiStep=1 right after onboarding. onDone does a
// soft client-side replace (no competing Server Component redirect
// exists on /studio, unlike /create-company), landing on the normal
// wizard with any firstTopic preserved.
export function StudioGeminiGate({
  dict,
  firstTopic,
}: {
  dict: (typeof dictionaries)["en"]["onboarding"];
  firstTopic?: string;
}) {
  const router = useRouter();

  function onDone() {
    const params = new URLSearchParams();
    if (firstTopic) params.set("firstTopic", firstTopic);
    router.replace(`/studio${params.toString() ? `?${params.toString()}` : ""}`);
  }

  return <GeminiOnboardingStep dict={dict} onDone={onDone} />;
}

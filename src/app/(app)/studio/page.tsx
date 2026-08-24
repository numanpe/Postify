import { requireCompany } from "@/lib/session";
import { WizardStep1Form } from "@/components/studio/wizard-step1-form";
import { resolveIndustryPack } from "@/lib/industry-packs";
import { shouldShowGeminiNudge } from "@/lib/gemini-nudge";
import { GeminiNudgeBanner } from "@/components/studio/gemini-nudge-banner";
import { StudioGeminiGate } from "@/components/onboarding/studio-gemini-gate";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionaries";

// Step 1 of the guided 3-step creation wizard. Bare /studio was
// deliberately left without a page during an earlier Vercel Hobby
// function-count reduction pass — no longer a constraint (the user has
// decided to stay on local dev and upgrade to Vercel Pro before going
// live, not work around the limit), so this is a real route again.
// /studio/poster and /studio/video (the [mode] dynamic route) stay
// directly reachable for returning users who want to skip the wizard —
// this page doesn't redirect or gate them in any way.
export default async function StudioWizardStep1Page({
  searchParams,
}: {
  searchParams: Promise<{ firstTopic?: string; showGeminiStep?: string }>;
}) {
  const { company } = await requireCompany();
  const { firstTopic, showGeminiStep } = await searchParams;
  const [showGeminiNudge, dict] = await Promise.all([
    shouldShowGeminiNudge(company.id),
    getDictionary(await getLocale()),
  ]);

  // Right after onboarding (see create-company-form.tsx /
  // website-first-onboarding.tsx) — shown here rather than on
  // /create-company itself; see studio-gemini-gate.tsx's comment for
  // the real race-condition bug that choice avoids.
  if (showGeminiStep === "1") {
    return <StudioGeminiGate dict={dict.onboarding} firstTopic={firstTopic} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <GeminiNudgeBanner
        show={showGeminiNudge}
        text={dict.studio.geminiNudgeText}
        dismissLabel={dict.studio.geminiNudgeDismiss}
      />
      <WizardStep1Form
        companyName={company.name}
        defaultTopic={firstTopic}
        topicSuggestions={resolveIndustryPack(company.primaryIndustry).topicSuggestions}
      />
    </div>
  );
}

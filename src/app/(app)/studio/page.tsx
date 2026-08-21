import { requireCompany } from "@/lib/session";
import { WizardStep1Form } from "@/components/studio/wizard-step1-form";

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
  searchParams: Promise<{ firstTopic?: string }>;
}) {
  const { company } = await requireCompany();
  const { firstTopic } = await searchParams;

  return (
    <div className="flex flex-col gap-6">
      <WizardStep1Form companyName={company.name} defaultTopic={firstTopic} />
    </div>
  );
}

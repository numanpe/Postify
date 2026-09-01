import { requireCompany } from "@/lib/session";
import { db } from "@/lib/db";
import { WizardStep2 } from "@/components/studio/wizard-step2";
import { TEMPLATE_IDS } from "@/lib/poster/template-ids";
import { getPreferredTemplateOrder } from "@/lib/creative-dna/template-preference";
import { resolveIndustryPack } from "@/lib/industry-packs";
import { getPickableMediaAssets } from "@/lib/media";

// Step 2 of the guided wizard. Reuses the exact same real PosterForm/
// VideoForm components (and their real generation actions) the
// standalone /studio/poster and /studio/video tools use — this page
// only adds the poster/video toggle and pre-fills from Step 1's
// chosen topic/caption via query params, it doesn't reimplement
// generation.
export default async function StudioWizardStep2Page({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string; caption?: string }>;
}) {
  const { company } = await requireCompany();
  const { topic, caption } = await searchParams;

  const [photoAssets, videoAssets, voiceCredential, preferredTemplates] = await Promise.all([
    // Shared with every other real media picker in the app (media.ts's
    // own doc comment) — this specific call site previously never
    // excluded storageDeletedAt, a real bug: a photo cleaned up by
    // cleanupMediaStorage could still be picked here and render broken.
    getPickableMediaAssets(company.id, { includeVideo: false }),
    getPickableMediaAssets(company.id, { includeVideo: true }),
    db.providerCredential.findFirst({
      where: { companyId: company.id, provider: { in: ["OPENAI", "ELEVENLABS", "FISH_AUDIO"] } },
    }),
    getPreferredTemplateOrder(company.id, TEMPLATE_IDS),
  ]);

  const narrationAvailable = company.voiceEngine === "FREE" || !!voiceCredential;

  return (
    <div className="flex flex-col gap-6">
      <WizardStep2
        defaultHeadline={caption ?? ""}
        defaultTopic={topic ?? ""}
        photoAssets={photoAssets}
        videoAssets={videoAssets}
        defaultBackgroundSource={photoAssets.length > 0 ? "PHOTO" : "BRAND"}
        narrationAvailable={narrationAvailable}
        preferredTemplateOrder={preferredTemplates.map((t) => t.template)}
        topicSuggestions={resolveIndustryPack(company.primaryIndustry, company.locale).topicSuggestions}
      />
    </div>
  );
}

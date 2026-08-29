import { requireCompany } from "@/lib/session";
import { db } from "@/lib/db";
import { WizardStep2 } from "@/components/studio/wizard-step2";
import { TEMPLATE_IDS } from "@/lib/poster/template-ids";
import { getPreferredTemplateOrder } from "@/lib/creative-dna/template-preference";
import { resolveIndustryPack } from "@/lib/industry-packs";

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
    // Same exclusions as studio/[mode]/page.tsx's PosterMode — no
    // posters/brand-logo assets offered back as a background photo.
    db.mediaAsset.findMany({
      where: { companyId: company.id, mimeType: { startsWith: "image/" }, posterOutput: null, brandKitLogo: null },
      orderBy: { createdAt: "desc" },
      select: { id: true, fileName: true },
    }),
    db.mediaAsset.findMany({
      where: {
        companyId: company.id,
        posterOutput: null,
        videoOutput: null,
        brandKitLogo: null,
        // See studio/[mode]/page.tsx's identical filter — a re-rendered
        // video's old asset passes videoOutput:null too, even though
        // its real file is gone.
        storageDeletedAt: null,
        OR: [{ mimeType: { startsWith: "image/" } }, { mimeType: { startsWith: "video/" } }],
      },
      orderBy: { createdAt: "asc" },
      select: { id: true, fileName: true, mimeType: true },
    }),
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
        topicSuggestions={resolveIndustryPack(company.primaryIndustry).topicSuggestions}
      />
    </div>
  );
}

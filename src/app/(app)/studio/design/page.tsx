import { requireCompany } from "@/lib/session";
import { db } from "@/lib/db";
import { WizardStep2 } from "@/components/studio/wizard-step2";
import { TEMPLATE_IDS } from "@/lib/poster/template-ids";
import { getPreferredTemplateOrder } from "@/lib/creative-dna/template-preference";
import { getCompanyContext, getTopicSuggestionChips } from "@/lib/company-context";
import { getPickableMediaAssets } from "@/lib/media";
import { getTextProviderForCompany } from "@/lib/providers/text/resolver";

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

  const [photoAssets, videoAssets, voiceCredential, preferredTemplates, companyContext] = await Promise.all([
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
    getCompanyContext(company.id),
  ]);
  const topicSuggestions = getTopicSuggestionChips(companyContext);

  const narrationAvailable = company.voiceEngine === "FREE" || !!voiceCredential;

  // Real bug fix (2026-09-04): this used to hand Step 1's full,
  // sentence-length caption straight to the poster headline field,
  // truncated only by the input's plain maxLength — a poster headline
  // needs to be a genuinely compact, punchy phrase, not a reused
  // caption. condensePosterHeadline produces a real, topic-grounded
  // short headline instead. Never blocks the page on failure — a
  // transient BYOK error here shouldn't stop the wizard from loading;
  // topic (already the shorter of the two real inputs Step 1 hands
  // over) is a reasonable, still-real fallback.
  let defaultHeadline = topic ?? "";
  if (caption) {
    try {
      const textProvider = await getTextProviderForCompany(company.id);
      const result = await textProvider.condensePosterHeadline({ context: companyContext, sourceText: caption });
      defaultHeadline = result.headline;
    } catch {
      defaultHeadline = topic || caption.slice(0, 70);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <WizardStep2
        defaultHeadline={defaultHeadline}
        defaultTopic={topic ?? ""}
        photoAssets={photoAssets}
        videoAssets={videoAssets}
        defaultBackgroundSource={photoAssets.length > 0 ? "PHOTO" : "BRAND"}
        narrationAvailable={narrationAvailable}
        preferredTemplateOrder={preferredTemplates.map((t) => t.template)}
        topicSuggestions={topicSuggestions}
      />
    </div>
  );
}

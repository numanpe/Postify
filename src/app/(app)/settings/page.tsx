import { requireCompany } from "@/lib/session";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getCompaniesRelyingOnSharedCredential } from "@/lib/providers/shared-provider-credential";
import { ProviderCredentialForm } from "@/components/settings/provider-credential-form";
import { ProviderCredentialRow } from "@/components/settings/provider-credential-row";
import { VoiceEngineToggle } from "@/components/settings/voice-engine-toggle";
import { WeeklyDigestToggle } from "@/components/settings/weekly-digest-toggle";
import { InactivityNudgeToggle } from "@/components/settings/inactivity-nudge-toggle";
import { ApiKeyGuide } from "@/components/settings/api-key-guide";
import { MusicCredits } from "@/components/settings/music-credits";
import { PublishingSettings } from "@/components/settings/publishing-settings";
import { CreativeDnaInsights } from "@/components/settings/creative-dna-insights";
import { CreativeDnaPreferencesPanel, type Dimension, type PreferenceRow } from "@/components/settings/creative-dna-preferences";
import { TeachAiPanel, type TeachableItem } from "@/components/settings/teach-ai-panel";
import { DeleteCompanySection } from "@/components/settings/delete-company-section";
import type { CreativeDnaConfidenceScores } from "@/lib/creative-dna/types";
import { ActionIcons } from "@/components/icons";
import type { AiProviderKind } from "@prisma/client";

// Brand names — not translated regardless of locale. CLOUDFLARE
// excluded on purpose: it's the platform-held free pool, never a BYOK
// credential a user can save (see AiProviderKind's own schema comment).
const PROVIDER_LABELS: Record<Exclude<AiProviderKind, "CLOUDFLARE">, string> = {
  OPENAI: "OpenAI",
  ANTHROPIC: "Anthropic",
  ELEVENLABS: "ElevenLabs",
  FISH_AUDIO: "Fish Audio",
  GEMINI: "Google Gemini",
};

export default async function SettingsPage() {
  const { user, company, role } = await requireCompany();
  const dict = getDictionary(await getLocale());

  const [credentials, sharedCredentials, companyCount, aggregatorCredentials, creativeDna, recentPosters, recentVideos] = await Promise.all([
    db.providerCredential.findMany({
      where: { companyId: company.id },
      orderBy: { createdAt: "asc" },
    }),
    db.sharedProviderCredential.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
    }),
    db.companyMember.count({ where: { userId: user.id } }),
    db.aggregatorCredential.findMany({
      where: { companyId: company.id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        provider: true,
        keyPreview: true,
        accountMap: true,
        accounts: { orderBy: [{ platform: "asc" }, { createdAt: "asc" }] },
      },
    }),
    db.creativeDna.findUnique({
      where: { companyId: company.id },
      select: { confidenceScores: true, lockedTopics: true },
    }),
    // Teach AI's "mark existing content" list — most recent 8 of each,
    // merged/trimmed below. Not paginated/searchable: a real, but
    // deliberately small, first version (Part 2's actual ask is the
    // explicit-signal mechanism, not a full content browser — Media
    // Library already exists for that).
    db.poster.findMany({
      where: { companyId: company.id },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        headline: true,
        createdAt: true,
        asset: { select: { storageKey: true, storageDeletedAt: true } },
      },
    }),
    db.video.findMany({
      where: { companyId: company.id },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, topic: true, createdAt: true, asset: { select: { storageDeletedAt: true } } },
    }),
  ]);
  const scores = creativeDna?.confidenceScores as Partial<CreativeDnaConfidenceScores> | undefined;

  // Same "no longer available" discipline as Media Library
  // (media/page.tsx) — a poster whose file was cleaned up still has a
  // real DB row, but showing its stale storage URL would render a
  // broken image instead of an honest state.
  const teachableItems: TeachableItem[] = [
    ...recentPosters
      .filter((p) => !p.asset.storageDeletedAt)
      .map((p) => ({
        id: p.id,
        kind: "poster" as const,
        thumbnailUrl: storage.url(p.asset.storageKey),
        label: p.headline,
        createdAt: p.createdAt,
      })),
    ...recentVideos
      .filter((v) => !v.asset.storageDeletedAt)
      .map((v) => ({ id: v.id, kind: "video" as const, thumbnailUrl: null, label: v.topic, createdAt: v.createdAt })),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 12)
    .map(({ id, kind, thumbnailUrl, label }) => ({ id, kind, thumbnailUrl, label }));

  // Per provider, show whichever credential is actually active for this
  // company — same company-first-then-shared priority the resolvers use
  // (src/lib/providers/shared-provider-credential.ts) — never both, so
  // the list never implies two keys are in play when only one is used.
  const sharedByProvider = new Map(sharedCredentials.map((c) => [c.provider, c]));
  const activeRows = await Promise.all(
    (Object.keys(PROVIDER_LABELS) as (keyof typeof PROVIDER_LABELS)[])
      .map((provider) => {
        const companyOwned = credentials.find((c) => c.provider === provider);
        if (companyOwned) {
          return { provider, id: companyOwned.id, keyPreview: companyOwned.keyPreview, scope: "COMPANY_ONLY" as const };
        }
        const shared = sharedByProvider.get(provider);
        if (shared) {
          return { provider, id: shared.id, keyPreview: shared.keyPreview, scope: "SHARED" as const };
        }
        return null;
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .map(async (row) => ({
        ...row,
        impactCompanyNames:
          row.scope === "SHARED"
            ? (await getCompaniesRelyingOnSharedCredential(user.id, row.provider, company.id)).map((c) => c.companyName)
            : [],
      })),
  );

  // Built server-side, not passed as a live dict lookup into the client
  // panel below — dict.settings.preferencesPositive/Negative are
  // functions (per-locale natural sentence structure), and functions
  // can't cross the Server -> Client Component prop boundary. See
  // creative-dna-preferences.tsx's PreferenceRow doc comment for the
  // real production bug this replaced.
  const dimensionLabels: Record<Dimension, string> = {
    topics: dict.settings.dimensionTopic,
    templates: dict.settings.dimensionTemplate,
    tones: dict.settings.dimensionTone,
    visualStyles: dict.settings.dimensionVisualStyle,
  };
  const preferenceRows: (PreferenceRow & { absScore: number })[] = (
    ["topics", "templates", "tones", "visualStyles"] as const
  ).flatMap((dimension) =>
    Object.entries(scores?.preferences?.[dimension] ?? {}).map(([value, score]) => ({
      dimension,
      value,
      sentence:
        score.score >= 0
          ? dict.settings.preferencesPositive(dimensionLabels[dimension], value)
          : dict.settings.preferencesNegative(dimensionLabels[dimension], value),
      absScore: Math.abs(score.score),
    })),
  );
  preferenceRows.sort((a, b) => b.absScore - a.absScore);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <ActionIcons.apiKey size={20} aria-hidden="true" />
          {dict.settings.title}
        </h1>
        <p className="text-sm text-ink-soft dark:text-ink-soft-dark">{dict.settings.subtitle}</p>
      </div>

      {activeRows.length > 0 && (
        <ul className="flex flex-col gap-2">
          {activeRows.map((row) => (
            <ProviderCredentialRow
              key={row.id}
              id={row.id}
              providerLabel={PROVIDER_LABELS[row.provider] ?? row.provider}
              keyPreview={row.keyPreview}
              scope={row.scope}
              companyName={company.name}
              canShare={companyCount > 1}
              impactCompanyNames={row.impactCompanyNames}
            />
          ))}
        </ul>
      )}

      <ProviderCredentialForm showScopeChoice={companyCount > 1} />

      <VoiceEngineToggle currentEngine={company.voiceEngine} />

      <WeeklyDigestToggle enabled={company.weeklyDigestEnabled} />

      <InactivityNudgeToggle enabled={company.inactivityNudgeEnabled} />

      <ApiKeyGuide dict={dict.settings} />

      <MusicCredits dict={dict.settings} />

      <PublishingSettings publishingMode={company.publishingMode} credentials={aggregatorCredentials} />

      <CreativeDnaInsights confidenceScores={creativeDna?.confidenceScores} />

      <CreativeDnaPreferencesPanel
        rows={preferenceRows.map(({ dimension, value, sentence }) => ({ dimension, value, sentence }))}
        lockedTopics={creativeDna?.lockedTopics ?? []}
        labels={{
          preferencesTitle: dict.settings.preferencesTitle,
          preferencesSubtitle: dict.settings.preferencesSubtitle,
          preferencesNoData: dict.settings.preferencesNoData,
          lockButton: dict.settings.lockButton,
          unlockButton: dict.settings.unlockButton,
          lockedBadge: dict.settings.lockedBadge,
          resetButton: dict.settings.resetButton,
          resetConfirm: dict.settings.resetConfirm,
          resetDone: dict.settings.resetDone,
          resetHint: dict.settings.resetHint,
        }}
      />

      <TeachAiPanel
        items={teachableItems}
        labels={{
          teachTitle: dict.settings.teachTitle,
          teachSubtitle: dict.settings.teachSubtitle,
          teachNoContent: dict.settings.teachNoContent,
          teachMoreLikeThis: dict.settings.teachMoreLikeThis,
          teachNeverLikeThis: dict.settings.teachNeverLikeThis,
          teachMarked: dict.settings.teachMarked,
          teachExampleTitle: dict.settings.teachExampleTitle,
          teachExampleSubtitle: dict.settings.teachExampleSubtitle,
          teachExampleFileLabel: dict.settings.teachExampleFileLabel,
          teachExampleTopicPlaceholder: dict.settings.teachExampleTopicPlaceholder,
          teachExampleStylePlaceholder: dict.settings.teachExampleStylePlaceholder,
          teachExampleSubmit: dict.settings.teachExampleSubmit,
          teachExampleSubmitting: dict.settings.teachExampleSubmitting,
          teachExampleDone: dict.settings.teachExampleDone,
        }}
      />

      {role === "OWNER" && <DeleteCompanySection companyName={company.name} />}
    </div>
  );
}

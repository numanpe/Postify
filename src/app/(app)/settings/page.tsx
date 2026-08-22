import { requireCompany } from "@/lib/session";
import { db } from "@/lib/db";
import { removeProviderCredential } from "@/lib/actions/provider-credentials";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { ProviderCredentialForm } from "@/components/settings/provider-credential-form";
import { VoiceEngineToggle } from "@/components/settings/voice-engine-toggle";
import { ApiKeyGuide } from "@/components/settings/api-key-guide";
import { PublishingSettings } from "@/components/settings/publishing-settings";
import { CreativeDnaInsights } from "@/components/settings/creative-dna-insights";
import { CreativeDnaPreferencesPanel, type Dimension, type PreferenceRow } from "@/components/settings/creative-dna-preferences";
import { DeleteCompanySection } from "@/components/settings/delete-company-section";
import type { CreativeDnaConfidenceScores } from "@/lib/creative-dna/types";
import { ActionIcons } from "@/components/icons";

// Brand names — not translated regardless of locale.
const PROVIDER_LABELS: Record<string, string> = {
  OPENAI: "OpenAI",
  ANTHROPIC: "Anthropic",
  ELEVENLABS: "ElevenLabs",
};

export default async function SettingsPage() {
  const { company, role } = await requireCompany();
  const dict = getDictionary(await getLocale());

  const [credentials, aggregatorCredentials, creativeDna] = await Promise.all([
    db.providerCredential.findMany({
      where: { companyId: company.id },
      orderBy: { createdAt: "asc" },
    }),
    db.aggregatorCredential.findMany({
      where: { companyId: company.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, provider: true, keyPreview: true },
    }),
    db.creativeDna.findUnique({
      where: { companyId: company.id },
      select: { confidenceScores: true, lockedTopics: true },
    }),
  ]);
  const scores = creativeDna?.confidenceScores as Partial<CreativeDnaConfidenceScores> | undefined;

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

      {credentials.length > 0 && (
        <ul className="flex flex-col gap-2">
          {credentials.map((credential) => (
            <li
              key={credential.id}
              className="flex items-center justify-between rounded-md border border-paper-border dark:border-night-border px-3 py-2 text-sm"
            >
              <span>
                {PROVIDER_LABELS[credential.provider] ?? credential.provider} — •••• {credential.keyPreview}
              </span>
              <form action={removeProviderCredential.bind(null, credential.id)}>
                <button
                  type="submit"
                  className="text-xs font-medium text-ink-soft dark:text-ink-soft-dark hover:text-ink dark:hover:text-ink-dark"
                >
                  {dict.common.remove}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <ProviderCredentialForm />

      <VoiceEngineToggle currentEngine={company.voiceEngine} />

      <ApiKeyGuide dict={dict.settings} />

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

      {role === "OWNER" && <DeleteCompanySection companyName={company.name} />}
    </div>
  );
}

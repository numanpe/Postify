import { requireCompany } from "@/lib/session";
import { db } from "@/lib/db";
import { removeProviderCredential } from "@/lib/actions/provider-credentials";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { ProviderCredentialForm } from "@/components/settings/provider-credential-form";

// Brand names — not translated regardless of locale.
const PROVIDER_LABELS: Record<string, string> = {
  OPENAI: "OpenAI",
  ANTHROPIC: "Anthropic",
};

export default async function SettingsPage() {
  const { company } = await requireCompany();
  const dict = getDictionary(await getLocale());

  const credentials = await db.providerCredential.findMany({
    where: { companyId: company.id },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{dict.settings.title}</h1>
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
    </div>
  );
}

import { requireCompany } from "@/lib/session";
import { db } from "@/lib/db";
import { removeProviderCredential } from "@/lib/actions/provider-credentials";
import { ProviderCredentialForm } from "@/components/settings/provider-credential-form";

const PROVIDER_LABELS: Record<string, string> = {
  OPENAI: "OpenAI",
  ANTHROPIC: "Anthropic",
};

export default async function SettingsPage() {
  const { company } = await requireCompany();

  const credentials = await db.providerCredential.findMany({
    where: { companyId: company.id },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">AI Providers</h1>
        <p className="text-sm text-neutral-500">
          Optional — Postify works fully without any key. Add your own OpenAI or Anthropic key for
          higher-quality generation. Your key is encrypted at rest and never shown again after
          saving.
        </p>
      </div>

      {credentials.length > 0 && (
        <ul className="flex flex-col gap-2">
          {credentials.map((credential) => (
            <li
              key={credential.id}
              className="flex items-center justify-between rounded-md border border-neutral-200 px-3 py-2 text-sm"
            >
              <span>
                {PROVIDER_LABELS[credential.provider] ?? credential.provider} — •••• {credential.keyPreview}
              </span>
              <form action={removeProviderCredential.bind(null, credential.id)}>
                <button
                  type="submit"
                  className="text-xs font-medium text-neutral-500 hover:text-neutral-900"
                >
                  Remove
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

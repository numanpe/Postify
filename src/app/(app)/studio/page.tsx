import { requireCompany } from "@/lib/session";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { GenerateCaptionForm } from "@/components/studio/generate-caption-form";

export default async function StudioPage() {
  const { company } = await requireCompany();
  const dict = getDictionary(await getLocale());

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{dict.studio.title}</h1>
        <p className="text-sm text-ink-soft dark:text-ink-soft-dark">{dict.studio.subtitle(company.name)}</p>
      </div>
      <GenerateCaptionForm />
    </div>
  );
}

import { requireCompany } from "@/lib/session";
import { GenerateCaptionForm } from "@/components/studio/generate-caption-form";

export default async function StudioPage() {
  const { company } = await requireCompany();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Content Studio</h1>
        <p className="text-sm text-neutral-500">
          Generate a social caption for {company.name}, tailored to your industry and brand tone.
        </p>
      </div>
      <GenerateCaptionForm />
    </div>
  );
}

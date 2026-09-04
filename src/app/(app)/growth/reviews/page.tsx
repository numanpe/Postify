import Link from "next/link";

import { requireCompany } from "@/lib/session";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { ReviewRequestForm } from "@/components/growth/review-request-form";

export default async function ReviewRequestPage() {
  const { company } = await requireCompany();
  const dict = getDictionary(await getLocale()).reviewRequest;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{dict.title}</h1>
        <p className="text-sm text-ink-soft dark:text-ink-soft-dark">{dict.subtitle}</p>
      </div>

      {company.whatsappNumber ? (
        <ReviewRequestForm />
      ) : (
        <div className="flex max-w-lg flex-col gap-3 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-800 dark:bg-amber-950/30">
          <p>{dict.noWhatsapp}</p>
          <Link href="/brand-kit" className="w-fit font-medium text-primary underline dark:text-primary-dark">
            {dict.goToSettings}
          </Link>
        </div>
      )}
    </div>
  );
}

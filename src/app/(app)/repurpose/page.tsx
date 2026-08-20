import { requireCompany } from "@/lib/session";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { RepurposeForm } from "@/components/repurpose/repurpose-form";

// Requests the platform's maximum available execution time — this page's
// Server Action (repurposeContent) can run a full poster AND video
// generation in one submit, same reasoning as campaigns/[id]/page.tsx.
export const maxDuration = 300;

export default async function RepurposePage() {
  const { company } = await requireCompany();
  const dict = getDictionary(await getLocale());

  const [posters, videos] = await Promise.all([
    db.poster.findMany({
      where: { companyId: company.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, headline: true },
    }),
    db.video.findMany({
      where: { companyId: company.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, topic: true },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{dict.repurpose.title}</h1>
        <p className="text-sm text-ink-soft dark:text-ink-soft-dark">{dict.repurpose.subtitle}</p>
      </div>
      <RepurposeForm posters={posters} videos={videos} />
    </div>
  );
}

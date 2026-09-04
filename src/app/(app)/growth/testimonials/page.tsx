import { requireCompany } from "@/lib/session";
import { db } from "@/lib/db";
import { ensurePublicBioSlug } from "@/lib/public-bio";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionaries";

const TESTIMONIALS_LIMIT = 30;

export default async function TestimonialsPage() {
  const { company } = await requireCompany();
  const dict = getDictionary(await getLocale()).testimonials;

  const [slug, testimonials] = await Promise.all([
    ensurePublicBioSlug(company.id),
    db.testimonial.findMany({
      where: { companyId: company.id },
      orderBy: { createdAt: "desc" },
      take: TESTIMONIALS_LIMIT,
    }),
  ]);

  // Same real base-URL construction Brand Kit's own bio-link display
  // already uses — one convention, not two.
  const appUrl = (process.env.APP_URL ?? "").replace(/\/$/, "");
  const testimonialUrl = `${appUrl}/testimonial/${slug}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{dict.title}</h1>
        <p className="text-sm text-ink-soft dark:text-ink-soft-dark">{dict.subtitle}</p>
      </div>

      <div className="flex flex-col gap-1 rounded-md border border-paper-border p-4 dark:border-night-border">
        <span className="text-xs font-medium text-ink-soft dark:text-ink-soft-dark">{dict.shareLinkLabel}</span>
        <a href={testimonialUrl} target="_blank" rel="noopener noreferrer" className="break-all text-sm underline underline-offset-2">
          {testimonialUrl}
        </a>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-ink-soft dark:text-ink-soft-dark">{dict.listTitle}</h2>
        {testimonials.length === 0 ? (
          <p className="text-sm text-ink-soft dark:text-ink-soft-dark">{dict.noneYet}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {testimonials.map((testimonial) => (
              <li key={testimonial.id} className="flex flex-col gap-1 rounded-md border border-paper-border p-3 text-sm dark:border-night-border">
                <p>{testimonial.text}</p>
                {testimonial.customerName && (
                  <p className="text-xs text-ink-soft dark:text-ink-soft-dark">— {testimonial.customerName}</p>
                )}
                {/* submitTestimonial is fully synchronous (no background
                    job) — by the time a Testimonial row exists, posterId
                    is already either a real id or permanently null,
                    never a real "still generating" state. If the poster
                    was later separately deleted from Media Library, this
                    link honestly 404s there rather than lying here. */}
                {testimonial.posterId ? (
                  <a href="/media" className="w-fit text-xs font-medium text-primary underline dark:text-primary-dark">
                    {dict.viewPoster}
                  </a>
                ) : (
                  <span className="text-xs text-amber-600 dark:text-amber-400">{dict.failed}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

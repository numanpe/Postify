import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { getPublicBioData } from "@/lib/public-bio";
import { TestimonialForm } from "@/components/growth/testimonial-form";

// Standalone top-level public route (same convention as /bio/[slug]) —
// no session/requireCompany() anywhere in this file. Reuses
// getPublicBioData rather than a second data-fetcher: it already
// returns everything this page needs (name, locale, brand colors,
// logo) and already enforces publicBioEnabled + ACTIVE status, so a
// disabled/suspended company's slug 404s here exactly like it does on
// the bio page.
const STRINGS = {
  EN: {
    title: "Share your experience",
    subtitle: (name: string) => `${name} would love to hear what you think — it only takes a moment.`,
    nameLabel: "Your name",
    nameOptional: "(optional)",
    textLabel: "Your review",
    textPlaceholder: "What did you like? A sentence or two is perfect.",
    submit: "Submit",
    submitting: "Submitting…",
    thankYouTitle: "Thank you!",
    thankYouBody: "Your review has been shared. We really appreciate it.",
    poweredBy: "Made with Postify",
  },
  AR: {
    title: "شاركونا تجربتكم",
    subtitle: (name: string) => `تسعد ${name} بمعرفة رأيكم — الأمر يستغرق لحظة فقط.`,
    nameLabel: "اسمكم",
    nameOptional: "(اختياري)",
    textLabel: "تقييمكم",
    textPlaceholder: "ما الذي أعجبكم؟ جملة أو جملتان تكفيان.",
    submit: "إرسال",
    submitting: "جارٍ الإرسال…",
    thankYouTitle: "شكرًا لكم!",
    thankYouBody: "تم مشاركة تقييمكم. نقدّر ذلك حقًا.",
    poweredBy: "أُنشئ باستخدام بوستيفاي",
  },
} as const;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await getPublicBioData(slug);
  if (!data) return { title: "Not found" };
  return { title: `${STRINGS[data.locale].title} — ${data.companyName}`, robots: { index: false, follow: false } };
}

export default async function PublicTestimonialPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getPublicBioData(slug);
  if (!data) notFound();

  const locale = data.locale === "AR" ? "AR" : "EN";
  const t = STRINGS[locale];
  const dir = locale === "AR" ? "rtl" : "ltr";
  const accent = data.accentColor ?? data.primaryColor ?? "#b5322f";

  return (
    <main dir={dir} className="flex min-h-dvh flex-col items-center gap-6 px-4 py-12 text-center">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        <p className="max-w-sm text-sm text-ink-soft dark:text-ink-soft-dark">{t.subtitle(data.companyName)}</p>
      </div>

      <TestimonialForm
        slug={slug}
        accentColor={accent}
        dir={dir}
        t={{
          nameLabel: t.nameLabel,
          nameOptional: t.nameOptional,
          textLabel: t.textLabel,
          textPlaceholder: t.textPlaceholder,
          submit: t.submit,
          submitting: t.submitting,
          thankYouTitle: t.thankYouTitle,
          thankYouBody: t.thankYouBody,
        }}
      />

      <p className="mt-auto pt-8 text-xs text-ink-soft dark:text-ink-soft-dark">{t.poweredBy}</p>
    </main>
  );
}

import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { getPublicBioData } from "@/lib/public-bio";

// Standalone top-level route (same convention as src/app/admin,
// src/app/digest-unsubscribe) — a real public page, no session/
// requireCompany() anywhere in this file. getPublicBioData already
// enforces publicBioEnabled + company status, so a disabled/suspended
// company's slug 404s here exactly like a slug that never existed.
function whatsappHref(number: string): string {
  const digits = number.replace(/[^0-9]/g, "");
  return `https://wa.me/${digits}`;
}

const STRINGS = {
  EN: { recentWork: "Recent work", poweredBy: "Made with Postify", visitWebsite: "Visit website", whatsapp: "Message on WhatsApp" },
  AR: { recentWork: "أحدث الأعمال", poweredBy: "أُنشئ باستخدام بوستيفاي", visitWebsite: "زيارة الموقع", whatsapp: "مراسلة عبر واتساب" },
} as const;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await getPublicBioData(slug);
  if (!data) return { title: "Not found" };
  return {
    title: data.companyName,
    description: data.businessDescription ?? undefined,
    robots: { index: true, follow: true },
  };
}

export default async function PublicBioPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getPublicBioData(slug);
  if (!data) notFound();

  const locale = data.locale === "AR" ? "AR" : "EN";
  const t = STRINGS[locale];
  const dir = locale === "AR" ? "rtl" : "ltr";

  const primary = data.primaryColor ?? "#1a1a1a";
  const accent = data.accentColor ?? data.primaryColor ?? "#b5322f";

  // Part 5 groundwork (folded in — no pre-existing landing-page JSON-LD
  // was actually found to extend, see project memory): a small, real,
  // additive structured-data block using only real data already on
  // this page. No speculative fields, nothing beyond what's rendered.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: data.companyName,
    ...(data.businessDescription ? { description: data.businessDescription } : {}),
    ...(data.logoUrl ? { logo: data.logoUrl } : {}),
    ...(data.websiteUrl ? { url: data.websiteUrl } : {}),
    ...(data.whatsappNumber
      ? { contactPoint: { "@type": "ContactPoint", contactType: "customer service", telephone: data.whatsappNumber } }
      : {}),
  };

  return (
    <main
      dir={dir}
      style={{ ["--bio-primary" as string]: primary, ["--bio-accent" as string]: accent }}
      className="flex min-h-dvh flex-col items-center gap-8 px-4 py-12 text-center"
    >
      {/* Real, own-generated JSON only — no user-controlled HTML ever reaches this. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {data.logoUrl && (
        <Image src={data.logoUrl} alt={data.companyName} width={96} height={96} className="rounded-full object-cover" unoptimized />
      )}

      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold" style={{ color: primary }}>
          {data.companyName}
        </h1>
        {data.businessDescription && (
          <p className="max-w-md text-sm text-ink-soft dark:text-ink-soft-dark">{data.businessDescription}</p>
        )}
      </div>

      {(data.websiteUrl || data.whatsappNumber) && (
        <div className="flex w-full max-w-xs flex-col gap-3">
          {data.websiteUrl && (
            <a
              href={data.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[48px] rounded-lg px-4 py-2 text-sm font-semibold text-white"
              style={{ backgroundColor: accent }}
            >
              {t.visitWebsite}
            </a>
          )}
          {data.whatsappNumber && (
            <a
              href={whatsappHref(data.whatsappNumber)}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[48px] rounded-lg border-2 px-4 py-2 text-sm font-semibold"
              style={{ borderColor: accent, color: accent }}
            >
              {t.whatsapp}
            </a>
          )}
        </div>
      )}

      {data.posters.length > 0 && (
        <div className="flex w-full max-w-md flex-col gap-3">
          <h2 className="text-sm font-medium text-ink-soft dark:text-ink-soft-dark">{t.recentWork}</h2>
          <div className="grid grid-cols-3 gap-2">
            {data.posters.map((poster) => (
              <div key={poster.id} className="aspect-square overflow-hidden rounded-md bg-paper-card dark:bg-night-card">
                <Image
                  src={poster.imageUrl}
                  alt={poster.headline}
                  width={200}
                  height={200}
                  className="h-full w-full object-cover"
                  unoptimized
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="mt-auto pt-8 text-xs text-ink-soft dark:text-ink-soft-dark">{t.poweredBy}</p>
    </main>
  );
}

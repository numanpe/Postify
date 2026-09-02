import Image from "next/image";

import { requireCompany } from "@/lib/session";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { BrandKitForm } from "@/components/brand-kit/brand-kit-form";
import { SecondaryNichesForm } from "@/components/brand-kit/secondary-niches-form";
import { TargetMarketForm } from "@/components/brand-kit/target-market-form";
import { PublicBioForm } from "@/components/brand-kit/public-bio-form";
import { ensurePublicBioSlug } from "@/lib/public-bio";

export default async function BrandKitPage() {
  const { company } = await requireCompany();
  const dict = getDictionary(await getLocale());

  const [brandKit, publicBioSlug] = await Promise.all([
    db.brandKit.findUnique({ where: { companyId: company.id }, include: { logoAsset: true } }),
    ensurePublicBioSlug(company.id),
  ]);
  const appUrl = (process.env.APP_URL ?? "").replace(/\/$/, "");
  const bioUrl = `${appUrl}/bio/${publicBioSlug}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{dict.brandKit.title}</h1>
        <p className="text-sm text-ink-soft dark:text-ink-soft-dark">{dict.brandKit.subtitle(company.name)}</p>
      </div>

      {brandKit?.logoAsset && (
        <Image
          src={storage.url(brandKit.logoAsset.storageKey)}
          alt="Current logo"
          width={brandKit.logoAsset.width ?? 96}
          height={brandKit.logoAsset.height ?? 96}
          className="h-24 w-24 rounded-md border border-paper-border dark:border-night-border object-contain"
          unoptimized
        />
      )}

      <SecondaryNichesForm secondaryNiches={company.secondaryNiches} />

      <TargetMarketForm targetMarket={company.targetMarket} />

      <BrandKitForm brandKit={brandKit} />

      <PublicBioForm
        bioUrl={bioUrl}
        enabled={company.publicBioEnabled}
        websiteUrl={company.websiteUrl}
        whatsappNumber={company.whatsappNumber}
      />
    </div>
  );
}

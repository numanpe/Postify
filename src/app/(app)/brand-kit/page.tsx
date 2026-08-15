import Image from "next/image";

import { requireCompany } from "@/lib/session";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { BrandKitForm } from "@/components/brand-kit/brand-kit-form";

export default async function BrandKitPage() {
  const { company } = await requireCompany();

  const brandKit = await db.brandKit.findUnique({
    where: { companyId: company.id },
    include: { logoAsset: true },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Brand Kit</h1>
        <p className="text-sm text-ink-soft dark:text-ink-soft-dark">Logo, colors, and fonts for {company.name}.</p>
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

      <BrandKitForm brandKit={brandKit} />
    </div>
  );
}

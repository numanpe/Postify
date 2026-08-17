import Image from "next/image";

import { requireCompany } from "@/lib/session";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { PosterForm } from "@/components/poster/poster-form";

export default async function PosterPage() {
  const { company } = await requireCompany();
  const dict = getDictionary(await getLocale());

  const [photoAssets, posters] = await Promise.all([
    // Excludes posterOutput and brandKitLogo assets — a generated
    // poster or the brand logo are both real MediaAssets, but offering
    // either back as a "photo" background would let a poster get
    // composited into another poster, or the logo used as a background
    // photo (confusing, and exactly the kind of synthetic-on-synthetic
    // output CLAUDE.md's authenticity rule is against). Only genuinely
    // uploaded photos belong here.
    db.mediaAsset.findMany({
      where: {
        companyId: company.id,
        mimeType: { startsWith: "image/" },
        posterOutput: null,
        brandKitLogo: null,
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, fileName: true },
    }),
    db.poster.findMany({
      where: { companyId: company.id },
      include: { asset: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{dict.poster.title}</h1>
        <p className="text-sm text-ink-soft dark:text-ink-soft-dark">{dict.poster.subtitle(company.name)}</p>
      </div>

      <PosterForm
        photoAssets={photoAssets}
        defaultBackgroundSource={photoAssets.length > 0 ? "PHOTO" : "BRAND"}
      />

      {posters.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-ink-soft dark:text-ink-soft-dark">{dict.poster.previousPosters}</h2>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {posters.map((poster) => (
              <li
                key={poster.id}
                className="flex flex-col gap-1 rounded-lg border border-paper-border dark:border-night-border p-2"
              >
                <Image
                  src={storage.url(poster.asset.storageKey)}
                  alt={poster.headline}
                  width={poster.asset.width ?? 400}
                  height={poster.asset.height ?? 400}
                  className="w-full rounded-md object-cover"
                  unoptimized
                />
                <p className="truncate text-xs font-medium" title={poster.headline}>
                  {poster.headline}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

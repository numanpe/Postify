import Image from "next/image";

import { requireCompany } from "@/lib/session";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { PosterForm } from "@/components/poster/poster-form";

export default async function PosterPage() {
  const { company } = await requireCompany();

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
        <h1 className="text-xl font-semibold">Poster Studio</h1>
        <p className="text-sm text-neutral-500">Generate a publish-ready poster for {company.name}.</p>
      </div>

      <PosterForm photoAssets={photoAssets} />

      {posters.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-neutral-500">Previous posters</h2>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {posters.map((poster) => (
              <li
                key={poster.id}
                className="flex flex-col gap-1 rounded-lg border border-neutral-200 p-2"
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

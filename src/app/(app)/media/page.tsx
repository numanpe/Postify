import Image from "next/image";

import { requireCompany } from "@/lib/session";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { formatBytes } from "@/lib/format";
import { deleteMedia } from "@/lib/actions/media";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { UploadMediaForm } from "@/components/media/upload-media-form";
import { EmptyState } from "@/components/empty-state";
import { NavIcons } from "@/components/icons";

export default async function MediaPage() {
  const { company } = await requireCompany();
  const dict = getDictionary(await getLocale());

  const assets = await db.mediaAsset.findMany({
    where: { companyId: company.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{dict.media.title}</h1>
        <p className="text-sm text-ink-soft dark:text-ink-soft-dark">{dict.media.subtitle(company.name)}</p>
      </div>

      <UploadMediaForm />

      {assets.length === 0 ? (
        <EmptyState icon={NavIcons.media} title={dict.media.noMedia} hint={dict.media.noMediaHint} />
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {assets.map((asset) => (
            <li key={asset.id} className="flex flex-col gap-2 rounded-lg border border-paper-border dark:border-night-border p-2">
              <div className="flex aspect-square items-center justify-center overflow-hidden rounded-md bg-paper-card dark:bg-night-card">
                {asset.storageDeletedAt ? (
                  // The real file is gone (cleanupMediaStorage ran after
                  // a re-render superseded it, or after a confirmed
                  // publish) — never attempt storage.url() on it, and
                  // never show the raw mimeType, which looks identical
                  // to a live asset's.
                  <span className="px-2 text-center text-xs text-ink-soft dark:text-ink-soft-dark">
                    {dict.media.noLongerAvailable}
                  </span>
                ) : asset.mimeType.startsWith("image/") ? (
                  <Image
                    src={storage.url(asset.storageKey)}
                    alt={asset.fileName}
                    width={asset.width ?? 300}
                    height={asset.height ?? 300}
                    className="h-full w-full object-cover"
                    unoptimized
                  />
                ) : (
                  <span className="text-xs text-ink-soft dark:text-ink-soft-dark">{asset.mimeType}</span>
                )}
              </div>
              <p className="truncate text-xs font-medium" title={asset.fileName}>
                {asset.fileName}
              </p>
              <p className="text-xs text-ink-soft dark:text-ink-soft-dark">
                {asset.width && asset.height ? `${asset.width}×${asset.height} · ` : ""}
                {formatBytes(asset.sizeBytes)}
              </p>
              <form action={deleteMedia.bind(null, asset.id)}>
                <button
                  type="submit"
                  className="w-full rounded-md border border-paper-border dark:border-night-border bg-paper dark:bg-night-card px-2 py-1 text-xs font-medium text-ink-soft dark:text-ink-soft-dark"
                >
                  {dict.common.delete}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

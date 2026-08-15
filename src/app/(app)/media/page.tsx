import Image from "next/image";

import { requireCompany } from "@/lib/session";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { formatBytes } from "@/lib/format";
import { deleteMedia } from "@/lib/actions/media";
import { UploadMediaForm } from "@/components/media/upload-media-form";

export default async function MediaPage() {
  const { company } = await requireCompany();

  const assets = await db.mediaAsset.findMany({
    where: { companyId: company.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Media Library</h1>
        <p className="text-sm text-neutral-500">
          Photos, video, audio, and brand assets for {company.name}. Tags shown here are
          structural only — semantic search arrives once AI tagging is built.
        </p>
      </div>

      <UploadMediaForm />

      {assets.length === 0 ? (
        <p className="text-sm text-neutral-500">No media uploaded yet.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {assets.map((asset) => (
            <li key={asset.id} className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-2">
              <div className="flex aspect-square items-center justify-center overflow-hidden rounded-md bg-neutral-100">
                {asset.mimeType.startsWith("image/") ? (
                  <Image
                    src={storage.url(asset.storageKey)}
                    alt={asset.fileName}
                    width={asset.width ?? 300}
                    height={asset.height ?? 300}
                    className="h-full w-full object-cover"
                    unoptimized
                  />
                ) : (
                  <span className="text-xs text-neutral-500">{asset.mimeType}</span>
                )}
              </div>
              <p className="truncate text-xs font-medium" title={asset.fileName}>
                {asset.fileName}
              </p>
              <p className="text-xs text-neutral-500">
                {asset.width && asset.height ? `${asset.width}×${asset.height} · ` : ""}
                {formatBytes(asset.sizeBytes)}
              </p>
              <form action={deleteMedia.bind(null, asset.id)}>
                <button
                  type="submit"
                  className="w-full rounded-md border border-neutral-300 px-2 py-1 text-xs font-medium text-neutral-700"
                >
                  Delete
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { requireCompany } from "@/lib/session";
import { createMediaAssetFromFile } from "@/lib/media";

export type UploadMediaState = { error: string } | undefined;

export async function uploadMedia(
  _prevState: UploadMediaState,
  formData: FormData,
): Promise<UploadMediaState> {
  const { user, company } = await requireCompany();

  const files = formData
    .getAll("files")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (files.length === 0) {
    return { error: "Choose at least one file." };
  }

  for (const file of files) {
    await createMediaAssetFromFile({
      companyId: company.id,
      uploadedById: user.id,
      file,
    });
  }

  revalidatePath("/media");
}

export async function deleteMedia(assetId: string): Promise<void> {
  const { company } = await requireCompany();

  // Ownership check: only delete assets that actually belong to the
  // caller's company, never trust the id alone.
  const asset = await db.mediaAsset.findFirst({
    where: { id: assetId, companyId: company.id },
  });
  if (!asset) return;

  await db.mediaAsset.delete({ where: { id: asset.id } });
  await storage.delete(asset.storageKey);

  revalidatePath("/media");
}

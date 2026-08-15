"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requireCompany } from "@/lib/session";
import { createMediaAssetFromFile } from "@/lib/media";

export type BrandKitState = { error: string } | undefined;

const optionalHex = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined))
  .refine((value) => value === undefined || /^#[0-9a-fA-F]{6}$/.test(value), {
    message: "Colors must be a hex value like #1A2B3C.",
  });

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined));

const BrandKitSchema = z.object({
  primaryColor: optionalHex,
  secondaryColor: optionalHex,
  accentColor: optionalHex,
  fontHeading: optionalText(100),
  fontBody: optionalText(100),
});

export async function updateBrandKit(
  _prevState: BrandKitState,
  formData: FormData,
): Promise<BrandKitState> {
  const { user, company } = await requireCompany();

  const parsed = BrandKitSchema.safeParse({
    primaryColor: formData.get("primaryColor"),
    secondaryColor: formData.get("secondaryColor"),
    accentColor: formData.get("accentColor"),
    fontHeading: formData.get("fontHeading"),
    fontBody: formData.get("fontBody"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const logoFile = formData.get("logo");
  let logoAssetId: string | undefined;

  if (logoFile instanceof File && logoFile.size > 0) {
    if (!logoFile.type.startsWith("image/")) {
      return { error: "Logo must be an image file." };
    }
    const asset = await createMediaAssetFromFile({
      companyId: company.id,
      uploadedById: user.id,
      file: logoFile,
    });
    logoAssetId = asset.id;
  }

  await db.brandKit.upsert({
    where: { companyId: company.id },
    create: {
      companyId: company.id,
      ...parsed.data,
      ...(logoAssetId ? { logoAssetId } : {}),
    },
    update: {
      ...parsed.data,
      ...(logoAssetId ? { logoAssetId } : {}),
    },
  });

  revalidatePath("/brand-kit");
}

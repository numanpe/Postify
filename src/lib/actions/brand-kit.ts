"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requireCompany } from "@/lib/session";
import { createMediaAssetFromFile } from "@/lib/media";

export type BrandKitState = { error: string } | undefined;

// nullish (not optional) — FormData.get() returns null, not undefined,
// for a field that isn't in the submission at all (e.g. the website
// importer applying fewer than 3 colors), and z.string() rejects null.
const optionalHex = z
  .string()
  .trim()
  .nullish()
  .transform((value) => (value ? value : undefined))
  .refine((value) => value === undefined || /^#[0-9a-fA-F]{6}$/.test(value), {
    message: "Colors must be a hex value like #1A2B3C.",
  });

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
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
  const logoImportUrl = formData.get("logoImportUrl");
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
  } else if (typeof logoImportUrl === "string" && logoImportUrl.trim()) {
    // Website brand import (Task 3) — the extracted logo is only ever a
    // remote URL until the user explicitly submits this real form; only
    // then is it actually downloaded and saved, same as a normal file
    // upload. A fetch failure here surfaces as a real error, never a
    // silently-skipped logo.
    let response: Response;
    try {
      response = await fetch(logoImportUrl, { signal: AbortSignal.timeout(15_000) });
    } catch {
      return { error: "Couldn't download the logo from that website." };
    }
    if (!response.ok) {
      return { error: "Couldn't download the logo from that website." };
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) {
      return { error: "The imported logo URL isn't an image." };
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const extension = contentType.split("/")[1]?.split(";")[0] ?? "png";
    const file = new File([buffer], `imported-logo.${extension}`, { type: contentType });
    const asset = await createMediaAssetFromFile({
      companyId: company.id,
      uploadedById: user.id,
      file,
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

"use server";

import { z } from "zod";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { INDUSTRIES } from "@/lib/industries";

export type CreateCompanyState = { error: string } | { success: true } | undefined;

const CreateCompanySchema = z.object({
  name: z.string().trim().min(1, "Company name is required.").max(200),
  primaryIndustry: z.enum(INDUSTRIES),
  secondaryNiches: z
    .string()
    .trim()
    .transform((value) =>
      value
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  locale: z.enum(["EN", "AR"]),
});

export async function createCompany(
  _prevState: CreateCompanyState,
  formData: FormData,
): Promise<CreateCompanyState> {
  const user = await requireUser();

  const parsed = CreateCompanySchema.safeParse({
    name: formData.get("name"),
    primaryIndustry: formData.get("primaryIndustry"),
    secondaryNiches: formData.get("secondaryNiches") ?? "",
    locale: formData.get("locale"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { name, primaryIndustry, secondaryNiches, locale } = parsed.data;

  await db.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: { name, primaryIndustry, secondaryNiches, locale },
    });

    await tx.companyMember.create({
      data: { userId: user.id, companyId: company.id, role: "OWNER" },
    });

    await tx.creativeDna.create({
      data: { companyId: company.id },
    });
  });

  // No next/navigation redirect() here on purpose: that triggers a soft
  // client-router transition, which does NOT re-run the root layout —
  // so <html lang/dir> and <LocaleProvider> (both resolved once there)
  // would keep showing whatever locale was current before this company
  // (and its locale) existed. The client form does a hard navigation on
  // success instead, which re-resolves everything fresh.
  return { success: true };
}

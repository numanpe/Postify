"use server";

import { z } from "zod";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { INDUSTRIES } from "@/lib/industries";

export type CreateCompanyState = { error: string } | undefined;

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
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { name, primaryIndustry, secondaryNiches } = parsed.data;

  await db.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: { name, primaryIndustry, secondaryNiches },
    });

    await tx.companyMember.create({
      data: { userId: user.id, companyId: company.id, role: "OWNER" },
    });

    await tx.creativeDna.create({
      data: { companyId: company.id },
    });
  });

  redirect("/media");
}

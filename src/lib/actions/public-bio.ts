"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requireCompany } from "@/lib/session";

export type PublicBioSettingsState = { error: string } | { success: true } | undefined;

const OptionalUrl = z.string().trim().max(300).url("Enter a valid URL (starting with https://).").optional().or(z.literal(""));
// Free-text, not strictly validated to a phone format — real numbers
// vary too much internationally (country code presence, spacing) to
// reliably validate; whatsappHref (src/app/bio/[slug]/page.tsx) strips
// everything but digits before building the wa.me link regardless, so
// a loosely-formatted real number still works.
const OptionalPhone = z.string().trim().max(30).optional().or(z.literal(""));
// Real business contact fields (2026-09-03, infographic poster
// template's contact row) — added to this same action/form since
// they're the same real-world concept as websiteUrl/whatsappNumber
// above ("public-facing company contact info"), not a new settings
// surface. Distinct from User.email (the owner's own login address).
const OptionalEmail = z.string().trim().max(200).email("Enter a valid email address.").optional().or(z.literal(""));

const Schema = z.object({
  websiteUrl: OptionalUrl,
  whatsappNumber: OptionalPhone,
  phone: OptionalPhone,
  contactEmail: OptionalEmail,
  publicBioEnabled: z.enum(["on"]).optional(),
});

export async function updatePublicBioSettings(_prevState: PublicBioSettingsState, formData: FormData): Promise<PublicBioSettingsState> {
  const { company } = await requireCompany();

  const parsed = Schema.safeParse({
    websiteUrl: formData.get("websiteUrl") || "",
    whatsappNumber: formData.get("whatsappNumber") || "",
    phone: formData.get("phone") || "",
    contactEmail: formData.get("contactEmail") || "",
    publicBioEnabled: formData.get("publicBioEnabled") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  await db.company.update({
    where: { id: company.id },
    data: {
      websiteUrl: parsed.data.websiteUrl || null,
      whatsappNumber: parsed.data.whatsappNumber || null,
      phone: parsed.data.phone || null,
      contactEmail: parsed.data.contactEmail || null,
      publicBioEnabled: parsed.data.publicBioEnabled === "on",
    },
  });

  revalidatePath("/brand-kit");
  return { success: true };
}

"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { db } from "@/lib/db";
import { requireUser, requireCompany, ACTIVE_COMPANY_COOKIE } from "@/lib/session";
import { INDUSTRIES } from "@/lib/industries";
import { storage } from "@/lib/storage";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionaries";

// Shared by createCompany and switchActiveCompany below — one real place
// for the cookie's write options.
async function setActiveCompanyCookie(companyId: string) {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_COMPANY_COOKIE, companyId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

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

  const company = await db.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: { name, primaryIndustry, secondaryNiches, locale },
    });

    await tx.companyMember.create({
      data: { userId: user.id, companyId: company.id, role: "OWNER" },
    });

    await tx.creativeDna.create({
      data: { companyId: company.id },
    });

    return company;
  });

  // Makes the just-created company active — otherwise resolveActiveMembership
  // (src/lib/session.ts) falls back to the OLDEST membership when no cookie
  // is set, and a second/third company would silently never become active
  // on its own. Real for multi-company users; a no-op in effect for a
  // brand-new user's first company (there's nothing else to fall back to).
  await setActiveCompanyCookie(company.id);

  // No next/navigation redirect() here on purpose: that triggers a soft
  // client-router transition, which does NOT re-run the root layout —
  // so <html lang/dir> and <LocaleProvider> (both resolved once there)
  // would keep showing whatever locale was current before this company
  // (and its locale) existed. The client form does a hard navigation on
  // success instead, which re-resolves everything fresh.
  return { success: true };
}

export type SwitchCompanyState = { error: string } | { success: true } | undefined;

// Backs the company switcher (src/components/company-switcher.tsx). Never
// trusts the client-supplied companyId blindly — re-verifies real
// membership server-side first, the same multi-tenant isolation boundary
// requireCompany() enforces everywhere else. Like createCompany above, the
// client does a hard navigation on success rather than a soft router
// refresh, so <html lang/dir> and LocaleProvider correctly re-resolve for
// the newly-active company's own locale.
export async function switchActiveCompany(
  _prevState: SwitchCompanyState,
  formData: FormData,
): Promise<SwitchCompanyState> {
  const user = await requireUser();

  const companyId = formData.get("companyId");
  if (typeof companyId !== "string" || !companyId) {
    return { error: "Invalid company." };
  }

  const membership = await db.companyMember.findFirst({ where: { userId: user.id, companyId } });
  if (!membership) {
    return { error: "You don't have access to that company." };
  }

  await setActiveCompanyCookie(companyId);

  return { success: true };
}

export type UpdateNichesState = { error: string } | { success: true } | undefined;

const UpdateNichesSchema = z.object({
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

// The only place secondaryNiches can be changed after onboarding —
// before this, create-company-form.tsx's one-time submit was the only
// writer, with no way to fix a stale or mistyped value afterward (a
// real gap: it feeds directly into every generated caption/script/
// campaign-brief's nicheLine, per prompt.ts and template-provider.ts).
export async function updateCompanyNiches(
  _prevState: UpdateNichesState,
  formData: FormData,
): Promise<UpdateNichesState> {
  const { company } = await requireCompany();

  const parsed = UpdateNichesSchema.safeParse({
    secondaryNiches: formData.get("secondaryNiches") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  await db.company.update({
    where: { id: company.id },
    data: { secondaryNiches: parsed.data.secondaryNiches },
  });

  revalidatePath("/brand-kit");
  return { success: true };
}

export type UpdateTargetMarketState = { error: string } | { success: true } | undefined;

const UpdateTargetMarketSchema = z.object({
  // Free text, not a geographic radius — see Company.targetMarket's
  // own schema comment. Optional: an empty submission clears it back
  // to null (a real, deliberate way to remove the field, not an error).
  targetMarket: z
    .string()
    .trim()
    .max(200, "Keep the target market under 200 characters.")
    .transform((value) => value || null),
});

// Same "editable after the fact" pattern updateCompanyNiches above
// already established — Part A of the local-content-awareness work.
// Feeds directly into every generated caption/script/campaign-brief's
// marketLine (prompt.ts) and the free tier's real marketLine/
// deriveMarketHashtags (template-provider.ts).
export async function updateTargetMarket(
  _prevState: UpdateTargetMarketState,
  formData: FormData,
): Promise<UpdateTargetMarketState> {
  const { company } = await requireCompany();

  const parsed = UpdateTargetMarketSchema.safeParse({
    targetMarket: formData.get("targetMarket") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  await db.company.update({
    where: { id: company.id },
    data: { targetMarket: parsed.data.targetMarket },
  });

  revalidatePath("/brand-kit");
  return { success: true };
}

export type ApplyBusinessContextState = { error: string } | { success: true } | undefined;

const ApplyBusinessContextSchema = z.object({
  businessDescription: z
    .string()
    .trim()
    .max(1000)
    .nullish()
    .transform((value) => (value ? value : undefined)),
  tone: z
    .string()
    .trim()
    .max(300)
    .nullish()
    .transform((value) => (value ? value : undefined)),
  additionalNiches: z
    .string()
    .trim()
    .nullish()
    .transform((value) =>
      value
        ? value
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean)
        : [],
    ),
});

// Part A2's website-extraction-derived business context (description,
// tone, likely products/services — src/lib/brand-context.ts) applied to
// real Company/CreativeDna data, distinct from updateBrandKit because
// these are genuinely different models (company profile / Creative
// DNA, not the visual Brand Kit). Same safety rule as everywhere else
// in this feature: only fields actually present in the submission are
// touched — an unreviewed/unedited field is never silently applied.
// Products merge into secondaryNiches (deduped) rather than replacing
// it outright — the user may already have manually-curated niches
// unrelated to this website extraction.
export async function applyExtractedBusinessContext(
  _prevState: ApplyBusinessContextState,
  formData: FormData,
): Promise<ApplyBusinessContextState> {
  const { company } = await requireCompany();

  const parsed = ApplyBusinessContextSchema.safeParse({
    businessDescription: formData.get("businessDescription"),
    tone: formData.get("tone"),
    additionalNiches: formData.get("additionalNiches"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { businessDescription, tone, additionalNiches } = parsed.data;

  if (businessDescription === undefined && tone === undefined && additionalNiches.length === 0) {
    return { error: "Nothing to apply — review at least one field first." };
  }

  await db.$transaction(async (tx) => {
    if (businessDescription !== undefined) {
      await tx.company.update({ where: { id: company.id }, data: { businessDescription } });
    }

    if (additionalNiches.length > 0) {
      const existing = await tx.company.findUniqueOrThrow({
        where: { id: company.id },
        select: { secondaryNiches: true },
      });
      const merged = [...new Set([...existing.secondaryNiches, ...additionalNiches])];
      await tx.company.update({ where: { id: company.id }, data: { secondaryNiches: merged } });
    }

    if (tone !== undefined) {
      const toneDescriptors = tone
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      await tx.creativeDna.upsert({
        where: { companyId: company.id },
        create: { companyId: company.id, toneDescriptors },
        update: { toneDescriptors },
      });
    }
  });

  revalidatePath("/brand-kit");
  return { success: true };
}

export type DeleteCompanyState = { error: string } | { success: true } | undefined;

// Real, permanent, self-service deletion — the "eventually be able to
// delete their own data" gap CLAUDE.md's data-handling stance implies.
// OWNER-gated: every company currently has exactly one member (no
// invite-a-teammate flow exists yet), but a future MEMBER role should
// not be able to take the whole company down. Storage cleanup happens
// AFTER the DB delete, not before/instead: Company cascades every
// company-scoped table (schema.prisma's onDelete: Cascade), but
// cascade only removes rows, not the real files in Vercel
// Blob/local-disk storage those MediaAsset rows pointed at — leaving
// those would be a real, if silent, "delete" that isn't actually
// complete, and a real privacy gap for photos containing sensitive
// content (a real one was found in this app's data during Phase 3
// verification). Best-effort (Promise.allSettled): the DB deletion is
// what makes the company actually gone from the product; one orphaned
// blob failing to delete shouldn't roll back a real, already-committed
// deletion the user asked for.
export async function deleteCompany(
  _prevState: DeleteCompanyState,
  formData: FormData,
): Promise<DeleteCompanyState> {
  const { company, role } = await requireCompany();
  const dict = getDictionary(await getLocale()).settings;

  if (role !== "OWNER") {
    return { error: dict.deleteCompanyNotOwner };
  }

  const confirmName = formData.get("confirmName");
  if (typeof confirmName !== "string" || confirmName.trim() !== company.name) {
    return { error: dict.deleteCompanyMismatch };
  }

  const assets = await db.mediaAsset.findMany({
    where: { companyId: company.id },
    select: { storageKey: true },
  });

  await db.company.delete({ where: { id: company.id } });

  await Promise.allSettled(assets.map((asset) => storage.delete(asset.storageKey)));

  // No redirect() here — same reasoning as createCompany above: a soft
  // client-router transition wouldn't re-resolve <html lang/dir> or
  // LocaleProvider now that the company (and its locale) is gone. The
  // client form does a hard navigation on success instead.
  return { success: true };
}

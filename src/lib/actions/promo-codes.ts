"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { requireCompany } from "@/lib/session";
import { recordSignal } from "@/lib/creative-dna/signals";
import { SIGNAL_STRENGTH } from "@/lib/creative-dna/signals";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I — avoids real human misreads when copied by hand

function generateCode(): string {
  const bytes = crypto.randomBytes(6);
  let code = "";
  for (const byte of bytes) code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  return code;
}

export type CreatePromoCodeState = { status: "success"; code: string } | { status: "error"; error: string } | undefined;

// Real, deliberate scope trim for this first pass: PromoCode.posterId
// exists in the schema (see its own doc comment) but nothing here sets
// it yet — no poster-picker UI in this MVP. A code is manually
// copy-pasted into whichever caption/poster the business is writing
// (every template already supports arbitrary free text), so no
// generation-pipeline wiring was needed to make this genuinely useful.
// Linking a code to a specific poster at creation time, if wanted
// later, would just be one more field on this same form.

// Real, unique code, retried on the rare real collision — same
// established pattern ensurePublicBioSlug (public-bio.ts) already uses
// for exactly this kind of "generate and persist a unique random
// string" problem.
export async function createPromoCode(_prevState: CreatePromoCodeState, formData: FormData): Promise<CreatePromoCodeState> {
  const { company } = await requireCompany();
  const label = String(formData.get("label") ?? "").trim().slice(0, 60) || null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateCode();
    try {
      await db.promoCode.create({ data: { companyId: company.id, code, label } });
      revalidatePath("/growth/promo-codes");
      return { status: "success", code };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") continue;
      throw error;
    }
  }
  return { status: "error", error: "Could not generate a unique code — please try again." };
}

// Manual "mark as redeemed" — a real business action (someone actually
// used the code), not automated tracking. Also records a real LIKE-
// strength CreativeSignal (the strongest existing explicit-signal tier
// — see signals.ts's SIGNAL_STRENGTH table): a redeemed promo code is
// about as concrete a real-world success signal as this app can
// observe, on par with the Teach AI feature's own explicit like/dislike
// control. posterId is threaded through as CreativeSignal's own plain
// (non-relation) provenance field when this code is linked to one, same
// convention as every other signal source.
export async function markPromoCodeRedeemed(promoCodeId: string): Promise<void> {
  const { company } = await requireCompany();

  const promoCode = await db.promoCode.findFirst({ where: { id: promoCodeId, companyId: company.id } });
  if (!promoCode) return;

  await db.promoCode.update({ where: { id: promoCode.id }, data: { redemptionCount: { increment: 1 } } });

  await recordSignal({
    companyId: company.id,
    sourceType: "LIKE",
    strength: SIGNAL_STRENGTH.LIKE,
    posterId: promoCode.posterId,
    metadata: { reason: "promo_code_redemption", code: promoCode.code, label: promoCode.label },
  });

  revalidatePath("/growth/promo-codes");
}

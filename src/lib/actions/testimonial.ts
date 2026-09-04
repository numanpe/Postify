"use server";

import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { generatePosterCore, PosterGenerationError } from "@/lib/poster/generate";

export type SubmitTestimonialState = { status: "success" } | { status: "error"; error: string } | undefined;

// Real caps so a testimonial's own text stays genuinely publishable as
// a poster subhead — matches the ~2-sentence hint in the public form's
// own placeholder copy, and stays comfortably under
// runPosterQualityGate's real density warning threshold rather than
// producing a technically-generated-but-visually-cramped poster.
const MAX_TEXT = 150;
const MIN_TEXT = 5;
const MAX_NAME = 40;

// Public, unauthenticated write (the one genuinely new surface like
// this in the app — see rate-limit.ts's own "testimonial-submit"
// comment). Reuses the SAME slug as the public bio page
// (Company.publicBioSlug) rather than adding a second slug field — one
// real public identity per company, not two parallel ones. The company
// is looked up FIRST (before any validation) specifically so every
// error message below — including "too many submissions" and "too
// short" — can be shown in the company's own real locale, same
// Arabic-first-class bar as every other user-facing surface, not just
// the ones deeper in the authenticated app.
export async function submitTestimonial(
  slug: string,
  _prevState: SubmitTestimonialState,
  formData: FormData,
): Promise<SubmitTestimonialState> {
  const company = await db.company.findUnique({
    where: { publicBioSlug: slug },
    select: { id: true, locale: true, status: true },
  });
  const dict = getDictionary(company?.locale === "AR" ? "ar" : "en").testimonialPublic;

  if (!company || company.status !== "ACTIVE") {
    return { status: "error", error: dict.notFound };
  }

  const rateLimit = await checkRateLimit("testimonial-submit");
  if (!rateLimit.allowed) {
    return { status: "error", error: dict.tooManySubmissions };
  }

  const text = String(formData.get("text") ?? "").trim();
  const customerName = String(formData.get("customerName") ?? "").trim() || null;

  if (text.length < MIN_TEXT) {
    return { status: "error", error: dict.tooShort };
  }
  if (text.length > MAX_TEXT) {
    return { status: "error", error: dict.tooLong(MAX_TEXT) };
  }
  if (customerName && customerName.length > MAX_NAME) {
    return { status: "error", error: dict.nameTooLong };
  }

  const testimonial = await db.testimonial.create({
    data: { companyId: company.id, customerName, text },
  });

  // generatePosterCore needs a real userId for attribution — no live
  // human session is driving this (public, unauthenticated submitter),
  // so the company's own OWNER is used, same "automated content needs a
  // real accountable member" convention process-campaign-items.ts
  // already established for scheduled/background generation.
  const owner = await db.companyMember.findFirst({
    where: { companyId: company.id, role: "OWNER" },
    orderBy: { createdAt: "asc" },
    select: { userId: true },
  });
  if (!owner) {
    // Real, honest partial state — the testimonial is still saved even
    // though no poster could be generated (e.g. every member somehow
    // downgraded to MEMBER, a state that shouldn't exist but isn't
    // impossible to hit through some future admin action).
    return { status: "success" };
  }

  const testimonialsDict = getDictionary(company.locale === "AR" ? "ar" : "en").testimonials;

  try {
    const result = await generatePosterCore({
      companyId: company.id,
      userId: owner.userId,
      headline: testimonialsDict.posterHeadline,
      subhead: text,
      cta: customerName ? `— ${customerName}` : undefined,
      aspectRatio: "SQUARE",
      template: "MINIMALIST_FRAME",
      backgroundSource: "BRAND",
    });
    await db.testimonial.update({ where: { id: testimonial.id }, data: { posterId: result.posterId } });
  } catch (error) {
    // Real, disclosed partial failure, not a silent loss: the
    // testimonial's own words are already saved regardless of whether
    // the poster could be generated. The admin testimonials page shows
    // this state honestly (dict.testimonials.failed) rather than
    // hiding it.
    if (!(error instanceof PosterGenerationError)) throw error;
  }

  return { status: "success" };
}

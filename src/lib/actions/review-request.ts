"use server";

import { requireCompany } from "@/lib/session";
import { getCompanyContext } from "@/lib/company-context";

// Real, free, deterministic message drafting (2026-09-04) — a review
// request is a short, functional utility message, not creative content,
// so it doesn't need a real LLM call the way captions do. A small set
// of real, hand-written, tone-aware variants (picked the same seeded
// way generateCaption's free tier already does — tone folded into the
// seed, same "genuinely changes the output" bar) genuinely reuses
// Creative DNA without the cost/latency of a new AI provider method for
// something this simple. No customer name/specific facts are ever
// invented — {{company}} is the only real substitution.
const VARIANTS_EN = [
  (company: string) =>
    `Hi! Thanks so much for choosing ${company} 😊 If you had a good experience, a quick review would really help us out — it only takes a minute!`,
  (company: string) =>
    `Hey there! We hope you enjoyed your experience with ${company}. Would you mind leaving us a quick review? It genuinely makes a difference for a small business like ours.`,
  (company: string) =>
    `Thank you for supporting ${company}! If you have a moment, we'd love to hear your thoughts in a short review.`,
];
const VARIANTS_AR = [
  (company: string) =>
    `مرحبًا! شكرًا جزيلاً لاختياركم ${company} 😊 إذا كانت تجربتكم جيدة، سيسعدنا حقًا لو تركتم لنا تقييمًا سريعًا — لا يستغرق سوى دقيقة!`,
  (company: string) =>
    `أهلًا بكم! نأمل أن تكونوا استمتعتم بتجربتكم مع ${company}. هل يمكنكم ترك تقييم سريع لنا؟ هذا يصنع فرقًا حقيقيًا لعمل صغير مثلنا.`,
  (company: string) => `شكرًا لدعمكم ${company}! إن سمح وقتكم، يسعدنا معرفة رأيكم في تقييم قصير.`,
];

function pickIndex(seed: string, length: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return hash % length;
}

export type ReviewRequestState =
  | { status: "success"; text: string; whatsappNumber: string | null }
  | undefined;

export async function draftReviewRequest(
  _prevState: ReviewRequestState,
  formData: FormData,
): Promise<ReviewRequestState> {
  const { company } = await requireCompany();
  const context = await getCompanyContext(company.id);
  const attempt = Number(formData.get("attempt")) || 0;

  const variants = context.locale === "AR" ? VARIANTS_AR : VARIANTS_EN;
  const index = pickIndex(`${company.id}:${context.tone}:${attempt}`, variants.length);
  const text = variants[index](company.name);

  return { status: "success", text, whatsappNumber: company.whatsappNumber };
}

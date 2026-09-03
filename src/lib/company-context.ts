import "server-only";

import { db } from "@/lib/db";
import { type Industry, type IndustryPack, resolveIndustry, resolveIndustryPack } from "@/lib/industry-packs";

export interface CompanyContext {
  companyId: string;
  name: string;
  industry: Industry;
  secondaryNiches: string[];
  // Creative DNA's explicit tone descriptors win when present (per
  // CLAUDE.md: explicit signals matter more than defaults); otherwise
  // fall back to the industry pack's default tone.
  tone: string;
  pack: IndustryPack;
  locale: "EN" | "AR";
  // Free-text company summary (manual entry or website extraction —
  // see Company.businessDescription in schema.prisma). Threaded into
  // BYOK prompts for real grounding; the free template tier doesn't
  // consume raw prose so this has no direct effect there.
  businessDescription: string | null;
  // Free text, e.g. "Abu Dhabi & Al Ain" — not a geographic radius (see
  // Company.targetMarket's own schema comment). Threaded into both BYOK
  // prompts (prompt.ts) and the free template tier (template-provider.ts,
  // where it also drives real region-derived hashtags) so generated
  // content is genuinely aware of who the company is trying to reach.
  targetMarket: string | null;
}

// Company-scoped by design — always called with a companyId already
// resolved through requireCompany()'s membership check, never a
// client-supplied id.
export async function getCompanyContext(companyId: string): Promise<CompanyContext> {
  const company = await db.company.findUniqueOrThrow({
    where: { id: companyId },
    include: { creativeDna: true },
  });

  // Company.primaryIndustry is a plain DB string column, not narrowed
  // to the Industry union — resolveIndustry (industry-packs.ts) is the
  // one real, shared place this defensive fallback lives now.
  const industry: Industry = resolveIndustry(company.primaryIndustry);
  // Locale-aware since 2026-09-02 — real Arabic content industry by
  // industry (see INDUSTRY_PACKS_AR's own doc comment); honestly falls
  // back to the English pack for any industry not yet covered.
  const pack = resolveIndustryPack(company.primaryIndustry, company.locale);

  const tone = company.creativeDna?.toneDescriptors.length
    ? company.creativeDna.toneDescriptors.join(", ")
    : pack.toneDefault;

  return {
    companyId: company.id,
    name: company.name,
    industry,
    secondaryNiches: company.secondaryNiches,
    tone,
    pack,
    locale: company.locale,
    businessDescription: company.businessDescription,
    targetMarket: company.targetMarket,
  };
}

// Real, confirmed-live bug (2026-09-04): this doc comment used to claim
// secondaryNiches was "safe to use in the same strict {{topic}} noun-
// phrase slots as autoTopics... since it's seeded from real extracted
// product names or short niche labels, never full sentences." A real
// company's real data (Graze Market: "Multi vendor Platform for animal
// feeds.") disproved that — website extraction and manual entry both
// produce free text, not a guaranteed noun phrase, and a trailing
// period spliced into "{{topic}} is proof that..." made
// capitalizeSentences() wrongly treat it as a sentence boundary
// ("...feeds. Is proof that..."). This doesn't rewrite or paraphrase
// the niche (no naturalization without an LLM) — it only strips the
// mechanical artifact that breaks template splicing.
export function sanitizeNicheText(niche: string): string {
  return niche.trim().replace(/[.!?]+$/, "").trim();
}

// Real per-company topic pool: the industry pack's generic autoTopics
// widened with this company's own secondaryNiches (real extracted
// product/service names from website onboarding, or short manually-
// added niche labels) when the company has any set.
//
// Real, confirmed gap (2026-09-01): "Auto-Generate Daily Idea," "Show
// me another idea," and the recurring daily plan's topic rotation
// (studio-wizard.ts, process-recurring-plans.ts) only ever drew from
// pack.autoTopics/topicSuggestions — never from secondaryNiches — so
// two companies in the same industry always saw byte-identical
// suggestions, even when one had real extracted business data and the
// other didn't. Each niche is sanitized (see sanitizeNicheText above)
// before joining autoTopics' pool, since real secondaryNiches data
// isn't guaranteed to already be a clean noun phrase.
//
// Companies with no secondaryNiches set (the common case for anyone
// who onboarded manually rather than via website extraction) see
// unchanged behavior — pack.autoTopics alone, exactly as before.
export function getCompanyTopicPool(context: CompanyContext): string[] {
  return context.secondaryNiches.length > 0
    ? [...context.pack.autoTopics, ...context.secondaryNiches.map(sanitizeNicheText)]
    : context.pack.autoTopics;
}

// Real, confirmed-live gap (2026-09-04): the topic-suggestion CHIPS
// shown on Studio's caption/video topic fields (topic-suggestions.tsx)
// came straight from resolveIndustryPack(...).topicSuggestions — a
// fixed 5-item array with zero rotation and zero niche-widening,
// byte-identical on every single page load, forever. This is a
// genuinely separate code path from "Auto-Generate Daily Idea" (real
// day-rotation, studio-wizard.ts) and "Show me another idea" (real
// randomization) — those already fix a DIFFERENT screen (the wizard's
// topic step, reached only after a user commits to a flow), not the
// suggestion chips shown immediately on the plain topic field.
//
// Widened with the company's own secondaryNiches (sanitized, see
// sanitizeNicheText above) and pack.autoTopics — both already-vetted
// real content, not new — then rotated by day the exact same way
// autoGenerate already does, so a company opening Studio on different
// days sees genuinely different chips, not a coincidental reshuffle,
// while staying stable within one session/day (no reshuffle mid-edit).
// A company with neither secondaryNiches nor extra pool items beyond
// the original 5 sees unchanged behavior.
export function getTopicSuggestionChips(
  context: CompanyContext,
  referenceDate: Date = new Date(),
): { label: string; topic: string }[] {
  const capitalize = (s: string) => (s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  const nicheChips = context.secondaryNiches.map((niche) => {
    const clean = sanitizeNicheText(niche);
    return { label: clean, topic: clean };
  });
  const autoTopicChips = context.pack.autoTopics.map((t) => ({ label: capitalize(t), topic: t }));
  const pool = [...context.pack.topicSuggestions, ...nicheChips, ...autoTopicChips];

  const CHIP_COUNT = 5;
  if (pool.length <= CHIP_COUNT) return pool;

  const dayIndex = Math.floor(referenceDate.getTime() / 86_400_000);
  const offset = dayIndex % pool.length;
  const seen = new Set<string>();
  const chips: { label: string; topic: string }[] = [];
  for (let i = 0; i < pool.length && chips.length < CHIP_COUNT; i += 1) {
    const candidate = pool[(offset + i) % pool.length];
    if (seen.has(candidate.label)) continue;
    seen.add(candidate.label);
    chips.push(candidate);
  }
  return chips;
}

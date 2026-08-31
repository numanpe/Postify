import "server-only";

import { db } from "@/lib/db";
import { type Industry, type IndustryPack, resolveIndustry, INDUSTRY_PACKS } from "@/lib/industry-packs";

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
  const pack = INDUSTRY_PACKS[industry];

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

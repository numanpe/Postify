import { INDUSTRIES, type Industry } from "@/lib/industries";

// Real, deterministic keyword matching — same pattern already
// established in template-provider.ts's inferCampaignType, not a new
// architectural style invented for this. Used for Part B2's "suggest a
// primary industry from the extracted website text" — always just a
// suggestion the user confirms or changes (createCompanyFromOnboarding
// never applies this without the user's own form submission), never a
// silent lock-in. Returns null rather than a forced guess when nothing
// scores a real match — an honest "we couldn't tell" beats a
// confidently wrong default.
const INDUSTRY_KEYWORDS: Record<Industry, string[]> = {
  Agriculture: ["farm", "crop", "harvest", "livestock", "agricultur", "irrigation", "orchard", "dairy", "poultry"],
  "Construction & Engineering": [
    "construction",
    "contractor",
    "engineering",
    "build",
    "renovat",
    "architect",
    "infrastructure",
    "civil engineer",
  ],
  Education: ["school", "student", "course", "curriculum", "teacher", "university", "academy", "tutoring", "learning"],
  "Real Estate": ["real estate", "property", "listing", "realtor", "mortgage", "apartment", "lease", "tenant"],
  Healthcare: ["clinic", "patient", "doctor", "medical", "healthcare", "dental", "therapy", "pharmacy", "physician"],
  "Retail & E-commerce": ["shop", "store", "checkout", "cart", "shipping", "product catalog", "retail", "e-commerce"],
  "Hospitality & Food": ["restaurant", "menu", "reservation", "hotel", "cafe", "catering", "cuisine", "dining"],
  "Professional Services": ["consult", "advisory", "law firm", "accounting", "legal services", "agency", "client services"],
  Other: [],
};

// Real bug found by testing against basecamp.com: a single incidental
// mention of "university" (a customer testimonial — "Shannon Kropf,
// Full Sail University" — not Basecamp's own industry at all) was
// enough to confidently suggest "Education" at a raw score of 1.
// Requiring at least 2 distinct keyword hits before suggesting anything
// meaningfully reduces that kind of one-off false positive from a
// testimonial, case study, or footer link — real homepage copy about a
// business's OWN industry tends to reinforce the same theme more than
// once, unlike an incidental customer name-drop.
const MIN_CONFIDENT_SCORE = 2;

export function inferIndustryFromText(text: string): Industry | null {
  const lower = text.toLowerCase();
  let bestIndustry: Industry | null = null;
  let bestScore = 0;

  for (const industry of INDUSTRIES) {
    if (industry === "Other") continue;
    const score = INDUSTRY_KEYWORDS[industry].reduce((count, keyword) => (lower.includes(keyword) ? count + 1 : count), 0);
    if (score > bestScore) {
      bestScore = score;
      bestIndustry = industry;
    }
  }

  return bestScore >= MIN_CONFIDENT_SCORE ? bestIndustry : null;
}

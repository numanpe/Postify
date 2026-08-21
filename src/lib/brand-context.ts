import "server-only";

import type { ExtractedBrandAssets } from "@/lib/brand-extract";
import type { TextProvider, SummarizeBusinessContextOutput } from "@/lib/providers/text/types";

// Part A2's extension of the website extractor beyond the visual Brand
// Kit (logo/colors/fonts — brand-extract.ts) into real business
// context: a short description, likely products/services, and a
// tone-of-voice descriptor. Deliberately reuses whichever TextProvider
// the company already has resolved (getTextProviderForCompany) rather
// than requiring its own key — on the free tier this runs a real,
// disclosed heuristic (see template-provider.ts's detectToneHeuristic),
// never blocking the whole website-import feature on requiring a paid
// key, and never silently skipping the step either.
export async function deriveBusinessContext(
  extracted: Pick<ExtractedBrandAssets, "metaDescription" | "ogDescription" | "visibleText">,
  companyName: string,
  textProvider: TextProvider,
): Promise<SummarizeBusinessContextOutput> {
  return textProvider.summarizeBusinessContext({
    companyName,
    metaDescription: extracted.metaDescription,
    ogDescription: extracted.ogDescription,
    visibleText: extracted.visibleText,
  });
}

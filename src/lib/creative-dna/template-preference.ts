import "server-only";

import { db } from "@/lib/db";
import type { CreativeDnaConfidenceScores } from "@/lib/creative-dna/types";

// Part 1.3: negative signals must reduce how often a template gets
// suggested, but must never let it collapse to zero — every template
// always keeps at least this much relative weight, so it can still be
// the one shown as default (rare, but possible) and is always fully
// selectable regardless either way. 0.15 means even a template with
// heavy accumulated negative signal never drops below ~15% of an
// otherwise-neutral template's weight.
const VARIETY_FLOOR = 0.15;

// Squashes an unbounded preference score (see aggregate.ts's
// PreferenceScore.score — a decayed, weighted sum, not itself a
// probability) into a 0..1 range before the floor is applied, so one
// very large accumulated score can't make every other template's
// floor-clamped weight negligible by comparison.
function squash(score: number): number {
  return 1 / (1 + Math.exp(-score));
}

export interface TemplateWeight {
  template: string;
  weight: number;
  score: number | null; // raw preference score, null = not enough evidence yet
  sampleSize: number;
}

// Orders a company's available templates by real accumulated
// preference (highest first) — used only to choose which one is
// pre-selected as the default in the picker; every template stays
// fully visible and selectable regardless of its position.
export async function getPreferredTemplateOrder(
  companyId: string,
  availableTemplates: readonly string[],
): Promise<TemplateWeight[]> {
  const creativeDna = await db.creativeDna.findUnique({
    where: { companyId },
    select: { confidenceScores: true },
  });
  const scores =
    (creativeDna?.confidenceScores as Partial<CreativeDnaConfidenceScores> | undefined)?.preferences?.templates ?? {};

  const weighted = availableTemplates.map((template) => {
    const entry = scores[template];
    const rawScore = entry?.score ?? 0;
    return {
      template,
      weight: Math.max(VARIETY_FLOOR, squash(rawScore)),
      score: entry ? rawScore : null,
      sampleSize: entry?.sampleSize ?? 0,
    };
  });

  return weighted.sort((a, b) => b.weight - a.weight);
}

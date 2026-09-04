import "server-only";

import type { TextProvider, GenerateCaptionInput, GenerateCaptionOutput } from "@/lib/providers/text/types";
import { wasContentDeleted } from "@/lib/creative-dna/signals";

const MAX_RETRIES = 4;

// Part 1.1's real, immediate rule: never regenerate the exact same
// output a company has explicitly deleted. Overrides generateCaption
// only (the primary text output a user directly deletes/regenerates in
// this app — see removeCampaignItem) rather than every TextProvider
// method; video scripts are structurally different (5 sections) and
// would need per-section fingerprinting, a real, disclosed scope limit
// for this pass, not silently skipped.
//
// Real bug found while verifying poster generation end-to-end: the
// original version of this function built its return value as
// `{ ...provider, generateCaption: ... }`. Object-spreading a class
// instance only copies its own enumerable properties (here, just the
// `name` field) — generateScript/generateCampaignBrief/
// expandBackgroundPrompt/summarizeBusinessContext all live on the
// class prototype, so the spread silently dropped every one of them.
// Every caller of getTextProviderForCompany() other than
// generateCaption was broken by this — confirmed live via a real
// "AI Background" poster generation throwing
// "expandBackgroundPrompt is not a function". Explicit per-method
// delegation below instead of a spread, so nothing this interface ever
// grows again can silently vanish the same way.
//
// Applied at getTextProviderForCompany's resolver level (not inside
// TemplateTextProvider/OpenAITextProvider/AnthropicTextProvider
// themselves) so every caller benefits automatically without each one
// needing to know this rule exists.
export function withDeletionAvoidance(provider: TextProvider, companyId: string): TextProvider {
  return {
    name: provider.name,
    // Not extended to replies (deliberately, same disclosed scope as
    // this file's own top comment) — a reply is grounded in a specific
    // incoming message, not a company-wide topic loop a real "regenerate
    // the same thing twice" pattern applies to.
    generateReply: (input) => provider.generateReply(input),
    generateScript: (input) => provider.generateScript(input),
    generateCampaignBrief: (input) => provider.generateCampaignBrief(input),
    expandBackgroundPrompt: (input) => provider.expandBackgroundPrompt(input),
    summarizeBusinessContext: (input) => provider.summarizeBusinessContext(input),
    clarifyTopic: (input) => provider.clarifyTopic(input),
    generatePosterHighlights: (input) => provider.generatePosterHighlights(input),
    editPosterSpec: (input) => provider.editPosterSpec(input),
    generateTopicSuggestions: (input) => provider.generateTopicSuggestions(input),
    condensePosterHeadline: (input) => provider.condensePosterHeadline(input),
    async generateCaption(input: GenerateCaptionInput): Promise<GenerateCaptionOutput> {
      let result = await provider.generateCaption(input);
      let attempt = input.variantIndex ?? 0;

      for (let i = 0; i < MAX_RETRIES; i += 1) {
        const blocked = await wasContentDeleted(companyId, result.text);
        if (!blocked) return result;
        // Bumping variantIndex is what already makes the free
        // template's otherwise fully-deterministic picker produce a
        // different real pick (see template-provider.ts's pick()) —
        // BYOK providers ignore variantIndex (their own sampling
        // already varies call to call), so a second identical call is
        // still a legitimate real retry there, just for a different
        // reason.
        attempt += 1;
        result = await provider.generateCaption({ ...input, variantIndex: attempt });
      }

      // Exhausted retries against a company that has deleted enough
      // near-identical variants that none are left — an honest
      // fallback (accept the repeat) beats an infinite loop or a
      // thrown error interrupting a real generation request.
      return result;
    },
  };
}

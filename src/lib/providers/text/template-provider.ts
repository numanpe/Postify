import "server-only";

import type { TextProvider, GenerateCaptionInput, GenerateCaptionOutput } from "./types";

function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}

// User-typed topics arrive lowercase more often than not, but templates
// splice {{topic}} into sentence-initial position sometimes ("{{topic}}
// — personalized...") and mid-sentence other times ("Ask about
// {{topic}}..."). Capitalizing every sentence start after assembly
// handles both without per-template bookkeeping.
function capitalizeSentences(text: string): string {
  return text.replace(/(^|[.!?]\s+)([a-z])/g, (_, lead: string, letter: string) => lead + letter.toUpperCase());
}

// Deterministic, not random: same company + topic always produces the
// same caption. That's a feature (consistent brand voice) and it keeps
// this honestly "rule-based" rather than faking AI-style variation.
function pickIndex(seed: string, length: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash % length;
}

// The zero-key free path: industry pack + company context filled into
// templates, no LLM call, works everywhere, never fails or rate-limits.
export class TemplateTextProvider implements TextProvider {
  readonly name = "Free (template)";

  async generateCaption({ context, topic }: GenerateCaptionInput): Promise<GenerateCaptionOutput> {
    const { pack, name, secondaryNiches, companyId } = context;
    const vars = { company: name, topic, niches: secondaryNiches.join(", ") };
    const seed = `${companyId}:${topic}`;

    const hook = fillTemplate(pack.hooks[pickIndex(`${seed}:h`, pack.hooks.length)], vars);
    const valueProp = fillTemplate(
      pack.valueProps[pickIndex(`${seed}:v`, pack.valueProps.length)],
      vars,
    );
    const cta = fillTemplate(pack.ctas[pickIndex(`${seed}:c`, pack.ctas.length)], vars);
    const nicheLine = secondaryNiches.length
      ? ` Specializing in ${secondaryNiches.join(", ")}.`
      : "";

    const text = capitalizeSentences(`${hook} ${valueProp}${nicheLine} ${cta}`.replace(/\s+/g, " ").trim());

    return { text, providerName: this.name };
  }
}

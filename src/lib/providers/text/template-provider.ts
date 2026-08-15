import "server-only";

import type {
  TextProvider,
  GenerateCaptionInput,
  GenerateCaptionOutput,
  GenerateScriptInput,
  GenerateScriptOutput,
  GenerateCampaignPlanInput,
  GenerateCampaignPlanOutput,
} from "./types";

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
// same caption/script. That's a feature (consistent brand voice) and
// it keeps this honestly "rule-based" rather than faking AI-style
// variation.
function pickIndex(seed: string, length: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash % length;
}

function pick(seed: string, tag: string, options: string[], vars: Record<string, string>): string {
  return capitalizeSentences(fillTemplate(options[pickIndex(`${seed}:${tag}`, options.length)], vars));
}

// A fixed marketing arc, not itemCount unrelated topics — this is what
// makes the free tier's plan "coherent" per CLAUDE.md's acceptance
// line. Two variants per stage so a typical week (5-7 items) doesn't
// repeat an exact angle; longer campaigns cycle back through the arc.
const CAMPAIGN_ARC: string[][] = [
  ["Introducing {{objective}}.", "Here's what's new: {{objective}}."],
  ["What makes {{objective}} worth it.", "A closer look at {{objective}}."],
  ["Why people are talking about {{objective}}.", "See what others are saying about {{objective}}."],
  ["Don't miss out on {{objective}}.", "Time's running out for {{objective}}."],
  ["One last look at {{objective}}.", "Before it's gone: {{objective}}."],
];

// The zero-key free path: industry pack + company context filled into
// templates, no LLM call, works everywhere, never fails or rate-limits.
export class TemplateTextProvider implements TextProvider {
  readonly name = "Free (template)";

  async generateCaption({ context, topic }: GenerateCaptionInput): Promise<GenerateCaptionOutput> {
    const { pack, name, secondaryNiches, companyId } = context;
    const vars = { company: name, topic, niches: secondaryNiches.join(", ") };
    const seed = `${companyId}:${topic}`;

    const hook = pick(seed, "h", pack.hooks, vars);
    const valueProp = pick(seed, "v", pack.valueProps, vars);
    const cta = pick(seed, "c", pack.ctas, vars);
    const nicheLine = secondaryNiches.length
      ? ` Specializing in ${secondaryNiches.join(", ")}.`
      : "";

    const text = `${hook} ${valueProp}${nicheLine} ${cta}`.replace(/\s+/g, " ").trim();

    return { text, providerName: this.name };
  }

  async generateScript({ context, topic }: GenerateScriptInput): Promise<GenerateScriptOutput> {
    const { pack, name, secondaryNiches, companyId } = context;
    const vars = { company: name, topic, niches: secondaryNiches.join(", ") };
    const seed = `${companyId}:${topic}:script`;

    return {
      script: {
        hook: pick(seed, "h", pack.hooks, vars),
        context: pick(seed, "sc", pack.scriptContexts, vars),
        value: pick(seed, "v", pack.valueProps, vars),
        message: pick(seed, "sm", pack.scriptMessages, vars),
        cta: pick(seed, "c", pack.ctas, vars),
      },
      providerName: this.name,
    };
  }

  async generateCampaignPlan({
    context,
    objective,
    itemCount,
  }: GenerateCampaignPlanInput): Promise<GenerateCampaignPlanOutput> {
    const vars = { company: context.name, objective };
    const angles: string[] = [];

    for (let i = 0; i < itemCount; i += 1) {
      const stage = CAMPAIGN_ARC[i % CAMPAIGN_ARC.length];
      const variant = stage[Math.floor(i / CAMPAIGN_ARC.length) % stage.length];
      angles.push(capitalizeSentences(fillTemplate(variant, vars)));
    }

    return { angles, providerName: this.name };
  }
}
